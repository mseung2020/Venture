from flask import Flask, render_template, request, jsonify
import finance

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_data', methods=['GET'])
def get_data_route():
    corp_name = request.args.get('corp_name', '').strip()
    if not corp_name:
        return jsonify({'error': '회사명이 제공되지 않았습니다.'}), 400
    try:
        data = finance.get_data(corp_name)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/search_stocks', methods=['GET'])
def search_stocks():
    query = request.args.get('query', '').strip().lower()
    if not query:
        return jsonify([])
    try:
        df = finance.load_stock_list()  # 금융 종목 리스트 로드 (이미 finance.py에 있음)
        # 회사명에 query가 포함된 행들을 검색 (대소문자 무시)
        filtered = df[df['회사명'].str.lower().str.contains(query)]
        # 회사명과 종목코드를 딕셔너리 리스트로 변환
        result = filtered[['회사명', '종목코드']].to_dict(orient='records')
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
