document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('mainContainer');
  
    mainContainer.addEventListener('click', async event => {
      const target = event.target;
  
      // 박스 삭제
      if (target.classList.contains('delete-btn')) {
        const box = target.closest('.report-box');
        if (box) {
          box.remove();
          updateBoxNumbers();
        }
        return;
      }
  
      // 박스 추가
      if (target.classList.contains('add-btn')) {
        const addButton = mainContainer.querySelector('.add-btn');
        const newBox = document.createElement('section');
        newBox.classList.add('report-box');  // 변경: report-box로 생성
        
        newBox.innerHTML = `
        <button class="delete-btn">삭제</button>

        <div class="company-input">
          <input type="text" class="corp-input" placeholder="회사명을 입력하세요 (예: 삼성전자)">
          <button class="confirm-btn">확인</button>
          <!-- 자동완성 리스트를 위한 컨테이너 -->
          <div class="suggestion-list"></div>
        </div>

        <!-- 전체 레이아웃: Summary + Table + Chart -->
        <!-- 전체 보고서 레이아웃 -->
        <div class="report-content">

          <!-- ✅ ① Summary 섹션 -->
          <section class="report-section summary-section">
            <h2>Summary</h2>
            <div class="content">
              <!-- Summary 내용 -->
              <table class="summary-table">
                <tbody>
                  <tr>
                    <th>NO.</th>
                    <td class="summary-no">-</td>
                  </tr>
                  <tr>
                    <th>회사명</th>
                    <td class="summary-name">-</td>
                  </tr>
                  <tr>
                    <th>상장여부</th>
                    <td class="summary-listing">-</td>
                  </tr>
                  <tr>
                    <th>시가총액</th>
                    <td class="summary-marketcap">-</td>
                  </tr>
                  <tr>
                    <th>매출액</th>
                    <td class="summary-sales">-</td>
                  </tr>
                  <tr>
                    <th>EBITDA</th>
                    <td class="summary-ebitda">-</td>
                  </tr>
                  <tr>
                    <th>PER</th>
                    <td class="summary-per">-</td>
                  </tr>
                  <tr>
                    <th>EV/EBITDA</th>
                    <td class="summary-ev_evita">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        
          <!-- ✅ ② 재무 테이블 섹션 -->
          <section class="report-section table-section">
            <div class="result-table-wrapper">
              <h2>Table</h2>
            </div>
          </section>
        
          <!-- ✅ ③ 차트 영역 섹터 (3등분) -->
          <section class="report-section chart-section">
            <h2>Charts</h2>
            <div class="chart-grid">

              <!-- 1번 칸: 매출액+EBIT/매출액 차트 + 지표 요약 -->
              <div class="chart-cell chart-sales-cell">
                <div class="metrics-summary">
                  <div class="metric-item">
                    <span class="label">Market&nbsp;Cap</span>
                    <span class="value metric-marketcap">-</span>
                    <span class="unit">억&nbsp;원</span>
                  </div>
                  <div class="metric-item">
                    <span class="label">PER</span>
                    <span class="value metric-per">-</span>
                    <span class="unit">배</span>
                  </div>
                  <div class="metric-item">
                    <span class="label">EV</span>
                    <span class="value metric-ev">-</span>
                    <span class="unit">억&nbsp;원</span>
                  </div>
                  <div class="metric-item">
                    <span class="label">EV/EBITDA</span>
                    <span class="value metric-ev_ebitda">-</span>
                    <span class="unit">배</span>
                  </div>
                </div>
                <canvas id="chart-sales"></canvas>
              </div>

              <!-- 2번 칸: 현금흐름 분석 차트 + 설명 입력 -->
              <div class="chart-cell chart-cashflow-cell">
                <canvas id="chart-cashflow"></canvas>
                <textarea class="cashflow-comment" placeholder="현금흐름 설명을 입력하세요"></textarea>
              </div>

              <!-- 3번 칸: (a) 현금성자산 차트, (b) 자산·부채·부채비율 차트 -->
              <div class="chart-cell chart-assets-cell">
                <div class="subcharts">
                  <div class="subchart left">
                    <canvas id="chart-cash-assets"></canvas>
                  </div>
                  <div class="subchart right">
                    <canvas id="chart-assets-liabilities"></canvas>
                  </div>
                </div>
              </div>

            </div>
          </section>
        
          <!-- ✅ ④ 수기 입력 섹션 -->
          <section class="report-section input-section">
            <h2>Manual Input</h2>
            <div class="content">
              <textarea class="normal-comment" placeholder="수기 입력 내용을 여기에 작성하세요"></textarea>
            </div>
          </section>
        
        </div>
        `;
        mainContainer.insertBefore(newBox, addButton);
        updateBoxNumbers();
        return;
      }
  
      // 확인 버튼 클릭 시
      if (target.classList.contains('confirm-btn')) {
        const box = target.closest('.report-box');
        const corpName = box.querySelector('.corp-input').value.trim().toUpperCase();
        const wrapper = box.querySelector('.result-table-wrapper');
        wrapper.style.display = 'block'; // 결과 영역을 보이게 함

        if (!corpName) {
          alert('회사명을 입력하세요.');
          return;
        }

        try {
          const res = await fetch(`/get_data?corp_name=${encodeURIComponent(corpName)}`);
          const data = await res.json();
          if (data.error) {
            alert(data.error);
            return;
          }

          // finance 데이터 (문자열)을 줄 단위로 분리하여 rowMap 생성
          const lines = data.finance.trim().split('\n');
          const rowMap = {};
          lines.forEach(line => {
            const [label, ...vals] = line.trim().split(/\s+/);
            rowMap[label] = vals.map(v => v.replace(/,/g, '')).map(Number);
          });

          const ebitdaVal = rowMap["EBITDA"] ? Number(rowMap["EBITDA"][3]) : null;
          const evVal     = rowMap["EV"]     ? Number(rowMap["EV"][3])     : null;
          let   evEbitda  = "-";
          if (evVal != null && ebitdaVal != null && ebitdaVal !== 0) {
            const ratio = evVal / ebitdaVal;
            evEbitda = ratio < 0 ? "n/a" : ratio.toFixed(2);
          }

          // 파생 지표 계산
          const percent = (a, b) =>
            (b && !isNaN(a) && !isNaN(b)) ? (a / b * 100).toFixed(1) + '%' : '';
          rowMap['영업이익률'] = rowMap['영업이익']?.map((v, i) => percent(v, rowMap['매출액'][i]));
          rowMap['EBITDA마진율'] = rowMap['EBITDA']?.map((v, i) => percent(v, rowMap['매출액'][i]));
          rowMap['당기순이익(%)'] = rowMap['당기순이익']?.map((v, i) => percent(v, rowMap['매출액'][i]));
          rowMap['부채비율'] = rowMap['부채']?.map((v, i) => percent(v, rowMap['자본'][i]));

          const format = val => isNaN(val) ? val : val.toLocaleString();

          const desiredOrder = [
            "매출액", "영업이익", "EBITDA", "당기순이익",
            "영업이익률", "EBITDA마진율", "당기순이익(%)",
            "자산", "부채", "자본", "현금및현금성자산",
            "부채비율", "영업활동으로인한현금흐름", "투자활동으로인한현금흐름", "재무활동으로인한현금흐름"
          ];

          // 새 테이블과 tbody 생성 (데이터 부분만 들어갈 새 tbody 생성)
          const newTable = document.createElement('table');
          newTable.classList.add('result-table');
          newTable.style.cssText = 'width: auto; border-collapse: collapse; margin-top: 0px;';
          newTable.innerHTML = `
            <thead>
              <tr style="background:#f0f0f0;">
                <th style="padding:10px; border:1px solid #ccc; text-align:left;">(단위: 억 원)</th>
                <th style="padding:10px; border:1px solid #ccc;">2021</th>
                <th style="padding:10px; border:1px solid #ccc;">2022</th>
                <th style="padding:10px; border:1px solid #ccc;">2023</th>
                <th style="padding:10px; border:1px solid #ccc;">2024</th>
              </tr>
            </thead>
            <tbody id="new-result-body"></tbody>
          `;
          const newTbody = newTable.querySelector('tbody');

          desiredOrder.forEach(label => {
            const row = document.createElement('tr');
            const values = rowMap[label] || ["", "", "", ""];
            const displayLabel = label.replace('으로인한', '');
            row.innerHTML = `
              <td style="padding:10px; border:1px solid #ccc; text-align:left;">${displayLabel}</td>
              ${values.map(v => `<td style="padding:10px; border:1px solid #ccc; text-align:right;">${format(v)}</td>`).join('')}
            `;
            newTbody.appendChild(row);
          });

          // 기존 결과 테이블 업데이트: 이미 테이블이 있으면 tbody 내용만 교체, 없으면 새 테이블 추가
          let existingTable = wrapper.querySelector('.result-table');
          if (existingTable) {
            existingTable.querySelector('tbody').innerHTML = newTbody.innerHTML;
          } else {
            wrapper.appendChild(newTable);
          }

          // --- Summary 섹션 업데이트 ---
          const summaryTable = box.querySelector('.summary-table');
          if (summaryTable) {
            // 박스 번호 업데이트 (동적 NO.)
            const allBoxes = document.querySelectorAll('.report-box');
            const boxIndex = Array.from(allBoxes).indexOf(box) + 1;
            summaryTable.querySelector('.summary-no').textContent = boxIndex;
            summaryTable.querySelector('.summary-name').textContent = corpName;

            // 네이버 금융 정보 업데이트 (상장여부, 시가총액)
            if (data.naver) {
              summaryTable.querySelector('.summary-listing').textContent = data.naver.listing;
              summaryTable.querySelector('.summary-marketcap').textContent = data.naver.market_cap;
            }

            // finance 데이터에서 2024년 값 (인덱스 3)으로 매출액, EBITDA 업데이트
            const sales2024 = rowMap["매출액"] ? rowMap["매출액"][3] : "-";
            summaryTable.querySelector('.summary-sales').textContent =
              isNaN(sales2024) ? sales2024 : sales2024.toLocaleString();

            const ebitda2024 = rowMap["EBITDA"] ? rowMap["EBITDA"][3] : "-";
            summaryTable.querySelector('.summary-ebitda').textContent =
              isNaN(ebitda2024) ? ebitda2024 : ebitda2024.toLocaleString();

            // PER 업데이트: FnGuide 크롤링한 PER 값 사용 (data.PER_FN)
            if (data.PER_FN && data.PER_FN !== "-") {
              summaryTable.querySelector('.summary-per').textContent = data.PER_FN;
            } else {
              summaryTable.querySelector('.summary-per').textContent = "n/a";
            }

            // EV/EBITDA 계산 업데이트 (2024년 값, 음수면 n/a)
            if (evVal != null && ebitdaVal != null && ebitdaVal !== 0 && !isNaN(evVal) && !isNaN(ebitdaVal)) {
              let computed = evVal / ebitdaVal;
              if (computed < 0) {
                ev_evita = "n/a";
              } else {
                ev_evita = computed.toFixed(2);
              }
            }
            summaryTable.querySelector('.summary-ev_evita').textContent = ev_evita;
          }

          // --- 1. 매출액 + EBIT/매출액 차트 ---
          const salesCtx = box.querySelector('#chart-sales').getContext('2d');
          if (!box._charts) box._charts = {};
          box._charts.sales?.destroy(); 
          box._charts.sales = new Chart(salesCtx, {
              type: 'bar',
            data: {
              labels: ['2021','2022','2023','2024'],
              datasets: [
                {
                  type: 'bar',
                  label: '매출액',
                  data: rowMap['매출액'],
                  order: 1,
                },
                {
                  type: 'line',
                  label: '영업이익률(%)',
                  data: rowMap['영업이익률']?.map(s => parseFloat(s)),
                  yAxisID: 'ratioAxis',
                  order: 99,
                  fill: false, 
                }
              ]
            },
            options: {
              scales: {
                y: { beginAtZero: true, position: 'left', title:{display:true, text:'금액(억)'} },
                ratioAxis: { beginAtZero: true, position: 'right', title:{display:true, text:'%'}, grid:{drawOnChartArea:false} },
              }
            }
          });

          // --- 2. 현금흐름 선 차트 ---
          const cfCtx = box.querySelector('#chart-cashflow').getContext('2d');
          if (!box._charts) box._charts = {};
          box._charts.cashflow?.destroy(); 
          box._charts.cashflow = new Chart(cfCtx, {
            type: 'line',
            data: {
              labels: ['2021','2022','2023','2024'],
              datasets: [
                { label:'영업활동현금흐름', data: rowMap['영업활동으로인한현금흐름'], fill:false },
                { label:'투자활동현금흐름', data: rowMap['투자활동으로인한현금흐름'], fill:false },
                { label:'재무활동현금흐름', data: rowMap['재무활동으로인한현금흐름'], fill:false },
              ]
            },
            options: { scales:{ y:{ beginAtZero:false, title:{display:true,text:'금액(억)'} } } }
          });

          // --- 3a. 현금성자산 막대그래프 ---
          const caCtx = box.querySelector('#chart-cash-assets').getContext('2d');
          if (!box._charts) box._charts = {};
          box._charts.cashAssets?.destroy(); 
          box._charts.cashAssets = new Chart(caCtx, {
            type: 'bar',
            data: {
              labels: ['2021','2022','2023','2024'],
              datasets: [{ label:'현금및현금성자산', data: rowMap['현금및현금성자산'] }]
            },
            options: { scales:{ y:{ beginAtZero:true, title:{display:true,text:'금액(억)'} } } }
          });

          // --- 3b. 자산·부채·부채비율 차트 ---
          const alCtx = box.querySelector('#chart-assets-liabilities').getContext('2d');
          if (!box._charts) box._charts = {};
          box._charts.assetsLiabilities?.destroy(); 
          box._charts.assetsLiabilities= new Chart(alCtx, {
            data: {
              labels: ['2021','2022','2023','2024'],
              datasets: [
                { type:'bar', label:'자산', data: rowMap['자산'] },
                { type:'bar', label:'부채', data: rowMap['부채'] },
                { type:'line', label:'부채비율(%)', data: rowMap['부채비율']?.map(v=>parseFloat(v)), yAxisID:'ratio2' }
              ]
            },
            options: {
              scales: {
                y: { beginAtZero:true, position:'left', title:{display:true,text:'금액(억)'} },
                ratio2: { beginAtZero:true, position:'right', title:{display:true,text:'%'}, grid:{drawOnChartArea:false} }
              }
            }
          });

          // --- 1번칸 지표 요약 채우기 ---
          const ms = box.querySelector('.metrics-summary');
          ms.querySelector('.metric-marketcap').textContent = data.naver.market_cap || '-';
          ms.querySelector('.metric-per').textContent       = data.PER_FN || '-';
          ms.querySelector('.metric-ev').textContent        = evVal?.toLocaleString() || '-';
          ms.querySelector('.metric-ev_ebitda').textContent = ev_evita       || '-';


        } catch (err) {
          alert(`요청 오류: ${err}`);
        }
        const chartSection = box.querySelector('.chart-section');
        chartSection.classList.add('loaded'); 
      }

    });

    mainContainer.addEventListener('keydown', event => {
      if (!event.target.classList.contains('corp-input')) return;
    
      const input        = event.target;
      const companyInput = input.closest('.company-input');
      const list         = companyInput.querySelector('.suggestion-list');
      const items        = list ? Array.from(list.children) : [];
      let   idx          = parseInt(list?.dataset.index ?? "-1", 10);
    
      switch (event.key){
        case "ArrowDown":
          if (items.length){
            event.preventDefault();
            idx = (idx + 1) % items.length;      // 다음 항목
            highlight(idx);
          }
          break;
    
        case "ArrowUp":
          if (items.length){
            event.preventDefault();
            idx = (idx - 1 + items.length) % items.length; // 이전 항목
            highlight(idx);
          }
          break;
    
        case "Enter":
          if (items.length && idx >= 0){
            event.preventDefault();
            items[idx].click();                  // 선택 확정
          }else{
            // 기존 로직: Enter 로 confirm‑btn 클릭
            const confirmBtn = companyInput.querySelector('.confirm-btn');
            confirmBtn?.click();
          }
          break;
      }
    
      // 선택 표시 함수
      function highlight(newIdx){
        items.forEach((el,i)=>el.classList.toggle('active', i===newIdx));
        list.dataset.index = String(newIdx);

        const active = items[newIdx];
        if (active){
          active.scrollIntoView({block:'nearest'});
        }
      }
    });
    

    // 자동완성 기능: 회사명 입력창에서 입력이 발생하면 실행됨
    mainContainer.addEventListener('input', async event => {
      if (event.target.classList.contains('corp-input')) {
        const query = event.target.value.trim();
        const suggestionContainer = event.target
          .closest('.company-input')
          .querySelector('.suggestion-list');

        suggestionContainer.style.display = 'none';
        suggestionContainer.innerHTML = '';
        suggestionContainer.dataset.index = "-1";

        if (!query) {
          return;
        }

        try {
          const res = await fetch(`/search_stocks?query=${encodeURIComponent(query)}`);
          const suggestions = await res.json();
          if (suggestions.error) {
            console.error(suggestions.error);
            return;
          }
          if (suggestions.length > 0) {
            suggestionContainer.style.display = 'block';
            suggestions.forEach(item => {
              const suggestionItem = document.createElement('div');
              suggestionItem.textContent = `${item.회사명} (${item.종목코드})`;
              suggestionItem.addEventListener('click', () => {
                event.target.value = item.회사명;
                // 목록 선택 후 목록 숨김
                suggestionContainer.style.display = 'none';
                suggestionContainer.innerHTML = '';
              });
              suggestionContainer.appendChild(suggestionItem);
            });
          }
        } catch (error) {
          console.error('Autocomplete error:', error);
        }
      }
    })

  });

function updateBoxNumbers() {
  // 모든 보고서 박스를 가져와서 순서대로 번호를 매깁니다.
  const boxes = document.querySelectorAll('.report-box');
  boxes.forEach((box, index) => {
    const summaryNoElem = box.querySelector('.summary-no');
    if (summaryNoElem) {
      summaryNoElem.textContent = index + 1; // index는 0부터 시작하므로 +1
    }
  });
}

/* ---------------- PDF Export ---------------- */
document.getElementById('btnExportPdf').addEventListener('click', async e => {
  e.preventDefault();

  // 차트가 로드된 보고서 박스만
  const boxes = Array.from(document.querySelectorAll('.report-box'))
                      .filter(b => b.querySelector('.chart-section.loaded'));
  if (!boxes.length) {
    alert('저장할 보고서가 없습니다.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf   = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  const m     = 10;                           // 여백(mm)
  const pW    = pdf.internal.pageSize.getWidth();   // 297
  const pH    = pdf.internal.pageSize.getHeight();  // 210
  const aW    = pW - m * 2;                   // 사용 가능 폭
  const aH    = pH - m * 2;                   // 사용 가능 높이
  let   yPos  = m;                            // 현재 페이지 y 시작점

  for (const box of boxes){
    /* ▼ ① 캡처 대상 요소를 report‑content 로 변경 */
    const target       = box.querySelector('.report-content');
    const prevOverflow = target.style.overflow;
    const prevWidth    = target.style.width;
  
    /* ▼ ② 가로 스크롤 전부 노출 */
    target.style.overflow = 'visible';
    target.style.width    = target.scrollWidth + 'px';
  
    /* ▼ ③ html2canvas 대상도 target 으로 */
    const canvas = await html2canvas(target, {
      backgroundColor:'#fff',
      scale:2,
      width:  target.scrollWidth,
      height: target.scrollHeight,
    });
  
    /* ▼ ④ 스타일 원상 복구 */
    target.style.overflow = prevOverflow;
    target.style.width    = prevWidth;

    /* ============ ④ PDF 삽입 ============ */
    const imgData = canvas.toDataURL('image/png');
    const ratio   = canvas.width / canvas.height;

    // 폭을 우선 여백 안에 맞추고, 높이가 넘치면 다시 축소
    let imgW = aW;
    let imgH = imgW / ratio;
    if (imgH > aH) {
      imgH = aH;
      imgW = imgH * ratio;
    }

    // 현재 페이지에 공간이 없으면 새 페이지
    if (yPos + imgH > pH - m) {
      pdf.addPage();
      yPos = m;
    }

    pdf.addImage(imgData, 'PNG', m, yPos, imgW, imgH, '', 'FAST');
    yPos += imgH + 6;          // 박스 간 간격 6 mm
  }

  pdf.save('report.pdf');
});



  