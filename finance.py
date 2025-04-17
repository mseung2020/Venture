import os
import pandas as pd
import requests
import logging
from bs4 import BeautifulSoup

# ------------------ 전역 상수 및 경로 ------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FOLDER = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_FOLDER, exist_ok=True)
STOCK_CACHE_FILE = os.path.join(DATA_FOLDER, "stock_list.csv")
STOCK_LIST_URL = 'http://kind.krx.co.kr/corpgeneral/corpList.do?method=download'

# ------------------ KRX 종목 리스트 로드 (캐싱 및 다운로드) ------------------
def load_stock_list():
    try:
        if os.path.exists(STOCK_CACHE_FILE):
            df = pd.read_csv(STOCK_CACHE_FILE, dtype={'종목코드': str})
        else:
            logging.info("캐시 파일이 없으므로 종목 리스트 다운로드 시작.")
            df = pd.read_html(STOCK_LIST_URL, encoding='euc-kr')[0]
            # 종목코드를 6자리 문자열로 포맷
            df['종목코드'] = df['종목코드'].apply(lambda x: f"{int(x):06d}")
            df = df.sort_values(by='회사명', ascending=True)
            df.to_csv(STOCK_CACHE_FILE, index=False)
            logging.info("종목 리스트 다운로드 및 저장 완료.")
        return df
    except Exception as e:
        logging.error("종목 리스트 로드 중 오류: %s", e)
        return pd.DataFrame()

# ------------------ CSV에서 회사명으로 종목코드(6자리) 찾기 ------------------
def get_stock_code_by_name(corp_name, df):
    corp_name_lower = corp_name.strip().lower()
    result = df[df['회사명'].str.lower() == corp_name_lower]
    if result.empty:
        raise ValueError(f"[ERROR] 회사명 '{corp_name}'에 해당하는 종목코드를 찾을 수 없습니다.")
    return result.iloc[0]['종목코드'].strip().zfill(6)

def extract_financial_data(soup, account_name):
    """
    주어진 soup 객체에서 계정명(account_name)과 정확히 일치하는 행을 찾아 
    앞 4개의 <td> 태그에 있는 값을 추출한다.
    """
    tr = None
    for th in soup.find_all("th"):
        text = th.get_text(strip=True)
        if text == account_name:
            tr = th.find_parent("tr")
            break

    if not tr:
        print(f"계정 '{account_name}'을(를) 찾지 못했습니다.")
        return None

    td_cells = tr.find_all("td", class_=lambda c: c and "r" in c)
    if len(td_cells) < 4:
        print(f"계정 '{account_name}'의 데이터 칼럼 수가 부족합니다. (찾은 셀 수: {len(td_cells)})")
        return None

    data = [td.get("title", td.get_text()).strip() for td in td_cells[:4]]
    return data

# ------------------ 네이버 금융 페이지 크롤링 함수 ------------------
def get_naver_data(stock_code):
    """
    네이버 금융 메인 페이지(예: https://finance.naver.com/item/main.naver?code=005930)에서
    현재가, 상장여부, 시가총액(억원), PER 값을 크롤링합니다.
    - 현재가: div id="rate_info_krx" 내 p.no_today (숫자만 추출)
    - 상장여부: div.wrap_company 내 img의 alt (예: "코스피" 또는 "코스닥")
    - 시가총액: 해당 페이지 내 시가총액 관련 th의 우측 td (콤마와 "억원" 제거)
    - PER: th에 "PER"가 포함된 항목의 우측 td
    """
    url = "https://finance.naver.com/item/main.naver?code=" + stock_code
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers)
    # 네이버 금융은 euc-kr 인코딩 사용
    response.encoding = "euc-kr"
    soup = BeautifulSoup(response.text, "html.parser")

    # 상장여부: wrap_company 내부의 이미지 alt 값 확인
    listing = "-"
    wrap_company = soup.find("div", class_="wrap_company")
    if wrap_company:
        img = wrap_company.find("img", class_=lambda x: x and ("kospi" in x or "kosdaq" in x))
        if img and img.has_attr("alt"):
            listing = img["alt"].strip()

    # 현재가: rate_info_krx 내 no_today element
    current_price = "-"
    rate_info = soup.find("div", id="rate_info_krx")
    if rate_info:
        no_today = rate_info.find("p", class_="no_today")
        if no_today:
            current_price = no_today.get_text(strip=True)
            import re
            # 숫자와 콤마만 남기고 추출 후 콤마 제거
            current_price = re.sub(r"[^\d]", "", current_price)

    # 시가총액: "시가총액" 문자열을 포함하는 th의 다음 td (콤마와 "억원" 제거)
    market_cap = "-"
    ths = soup.find_all("th")
    for th in ths:
        if "시가총액" in th.get_text():
            td = th.find_next_sibling("td")
            if td:
                raw = td.get_text(strip=True).replace(",", "").replace("억원", "")
                # ↓ 숫자인지 확인 후 천단위 콤마 찍기
                if raw.isdigit():
                    market_cap = f"{int(raw):,}"     # 3,245,678
                else:
                    market_cap = raw
            break

    return {
        "current_price": current_price,
        "listing": listing,
        "market_cap": market_cap,
    }

def get_data(corp_name):
    """
    입력받은 회사명(corp_name)을 바탕으로 KRX 종목코드를 조회하고,
    재무정보, EBITDA, EV 정보를 크롤링하여 각 계정별로 마지막 4개 값을 DataFrame으로 반환하고,
    추가로 네이버 금융 페이지에서 상장여부, 시가총액(억원), PER, 현재가 정보를 가져옵니다.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/115.0 Safari/537.36"
        )
    }
    
    # 종목코드 조회
    stock_df = load_stock_list()
    stock_code = get_stock_code_by_name(corp_name, stock_df)
    # finance 사이트에서 사용하는 코드는 A+종목코드 형식임
    gicode = "A" + stock_code
    
    # ------------------ 재무정보 (대차대조표, 손익계산서, 현금흐름표) ------------------
    finance_url = (
        "https://comp.fnguide.com/SVO2/ASP/SVD_Finance.asp?"
        f"pGB=1&gicode={gicode}&cID=&MenuYn=Y&ReportGB=&NewMenuID=103&stkGb=701"
    )
    response_finance = requests.get(finance_url, headers=headers)
    response_finance.encoding = "utf-8"
    soup_finance = BeautifulSoup(response_finance.text, "html.parser")
    
    # 추출할 계정명 리스트
    balance_sheet_accounts = ["자산", "부채", "자본", "현금및현금성자산"]
    income_statement_accounts = ["매출액", "영업이익", "당기순이익"]
    cash_flow_accounts = ["영업활동으로인한현금흐름", "투자활동으로인한현금흐름", "재무활동으로인한현금흐름"]
    
    # 결과 저장용 딕셔너리 (각 계정: list of 4 값)
    result = {}
    
    for account in balance_sheet_accounts:
        data = extract_financial_data(soup_finance, account)
        if data:
            result[account] = data
    
    for account in income_statement_accounts:
        data = extract_financial_data(soup_finance, account)
        if data:
            result[account] = data

    for account in cash_flow_accounts:
        data = extract_financial_data(soup_finance, account)
        if data:
            result[account] = data

    # ------------------ EBITDA 및 PER 정보 ------------------
    ebitda_url = (
        "https://comp.fnguide.com/SVO2/ASP/SVD_FinanceRatio.asp?"
        f"pGB=1&gicode={gicode}&cID=&MenuYn=Y&ReportGB=&NewMenuID=104&stkGb=701"
    )
    response_ebitda = requests.get(ebitda_url, headers=headers)
    response_ebitda.encoding = "utf-8"
    soup_ebitda = BeautifulSoup(response_ebitda.text, "html.parser")
    
    ebitda_tr = soup_ebitda.find("tr", class_="c_grid1_11 rwf acd_dep2_sub")
    if not ebitda_tr:
        print("EBITDA 행을 찾지 못했습니다.")
    else:
        td_elements = ebitda_tr.find_all("td")[-4:]
        ebitda_values = [td.get("title", td.get_text()).strip() for td in td_elements]
        result["EBITDA"] = ebitda_values
    
    # PER 크롤링: FnGuide 페이지 내 div#corp_group2 영역의 PER 값 추출
    per = "-"
    corp_group = soup_ebitda.find("div", id="corp_group2")
    if corp_group:
        a_per = corp_group.find("a", id="h_per")
        if a_per:
            dt = a_per.find_parent("dt")
            if dt:
                dd = dt.find_next_sibling("dd")
                if dd:
                    per = dd.get_text(strip=True)
    result["PER_FN"] = per

    # ------------------ EV 정보 ------------------
    invest_url = (
        "https://comp.fnguide.com/SVO2/ASP/SVD_Invest.asp?"
        f"pGB=1&gicode={gicode}&cID=&MenuYn=Y&ReportGB=&NewMenuID=105&stkGb=701"
    )
    response_invest = requests.get(invest_url, headers=headers)
    response_invest.encoding = "utf-8"
    soup_invest = BeautifulSoup(response_invest.text, "html.parser")
    
    ev_tr = soup_invest.find("tr", class_="c_grid1_14 rwf acd_dep2_sub")
    if not ev_tr:
        print("EV 행을 찾지 못했습니다.")
    else:
        td_elements = ev_tr.find_all("td")[-4:]
        ev_values = [td.get("title", td.get_text()).strip() for td in td_elements]
        result["EV"] = ev_values

    # ------------------ DataFrame 변환 ------------------
    fn_per = result.pop("PER_FN", "-")
    columns = ['2021', '2022', '2023', '2024']
    df = pd.DataFrame.from_dict(result, orient='index', columns=columns)
    df.index.name = '계정'

    # ------------------ 네이버 금융 정보 크롤링 ------------------
    naver_info = get_naver_data(stock_code)

    # ------------------ 결과 반환 ------------------
    # finance 데이터는 텍스트 형태로, 네이버 정보는 별도 dict로 JSON에 포함
    return {
        "finance": df.to_string(),
        "naver": naver_info,
        "PER_FN": fn_per
    }

# 단독 실행 시 예시
if __name__ == "__main__":
    corp_name = input("회사명을 입력하세요: ").strip()
    try:
        result = get_data(corp_name)
        print(result)
    except Exception as e:
        print(e)
