import os
import json
import base64
import io
import itertools
from datetime import datetime
from flask import Flask, request, render_template, jsonify, send_file
import requests
from dotenv import load_dotenv
import uuid

load_dotenv()

# --- 환경 변수 설정 ---
API_BEARER_TOKEN = os.getenv('API_BEARER_TOKEN')
API_KEY_ENV = os.getenv("API_KEY")
API_URL_ENV = os.getenv("API_URL")

# --- API 키 관리 ---
API_KEYS = [k.strip() for k in API_KEY_ENV.split(",")] if API_KEY_ENV else []
API_KEY_CYCLE = itertools.cycle(API_KEYS) if API_KEYS else None

# --- Flask 앱 설정 ---
app = Flask(__name__)
app.secret_key = os.urandom(24)

# 임시 디렉토리 사용
UPLOAD_FOLDER = '/tmp/uploads'
RESULT_FOLDER = '/tmp/results'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

# 메모리에 저장할 데이터
image_gallery = []
like_records = {}  # IP별 좋아요 기록 저장

def get_client_ip():
    """클라이언트 IP 주소 가져오기"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    else:
        return request.remote_addr

def make_headers():
    headers = {"Content-Type": "application/json"}
    if API_BEARER_TOKEN:
        headers["Authorization"] = f"Bearer {API_BEARER_TOKEN}"
    return headers

def send_request_sync(payload):
    global API_KEYS, API_KEY_CYCLE
    headers = make_headers()

    if API_KEYS:
        keys_to_try = list(API_KEYS)
        for _ in range(len(keys_to_try)):
            key = next(API_KEY_CYCLE)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key={key}"
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=60)
                
                if response.status_code == 400:
                    data = response.json()
                    if "error" in data:
                        details = data["error"].get("details", [])
                        if any(d.get("reason") == "API_KEY_INVALID" for d in details):
                            print(f"⚠️ Invalid API key 제외: {key}")
                            API_KEYS = [k for k in API_KEYS if k != key]
                            API_KEY_CYCLE = itertools.cycle(API_KEYS) if API_KEYS else None
                            continue

                response.raise_for_status()
                return response.json()
                
            except Exception as e:
                print(f"❌ {url} 요청 실패: {e}")
                continue
        raise RuntimeError("🚨 모든 API KEY 실패")
    else:
        if not API_URL_ENV:
            raise RuntimeError("🚨 API_KEY도 API_URL도 없음. 환경변수 확인하세요.")
        try:
            response = requests.post(API_URL_ENV, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"❌ {API_URL_ENV} 요청 실패: {e}")
            raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/gallery')
def gallery():
    # 정렬 옵션
    sort_by = request.args.get('sort', 'newest')
    
    sorted_gallery = image_gallery.copy()
    
    if sort_by == 'oldest':
        sorted_gallery.sort(key=lambda x: x['created_at'])
    elif sort_by == 'likes':
        sorted_gallery.sort(key=lambda x: x['likes'], reverse=True)
    else:  # newest (default)
        sorted_gallery.sort(key=lambda x: x['created_at'], reverse=True)
    
    # 현재 사용자 IP의 좋아요 기록 확인
    client_ip = get_client_ip()
    user_likes = like_records.get(client_ip, set())
    
    # 각 이미지에 현재 사용자가 좋아요했는지 표시
    for item in sorted_gallery:
        item['user_liked'] = item['id'] in user_likes
    
    return render_template('gallery.html', images=sorted_gallery, current_sort=sort_by)

# 임시 파일 서빙을 위한 라우트
@app.route('/user_content/<filename>')
def serve_user_content(filename):
    try:
        upload_path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.exists(upload_path):
            return send_file(upload_path, as_attachment=False)
        
        result_path = os.path.join(RESULT_FOLDER, filename)
        if os.path.exists(result_path):
            return send_file(result_path, as_attachment=False)
        
        return jsonify({'error': '파일을 찾을 수 없습니다.'}), 404
    except Exception as e:
        print(f"파일 서빙 에러: {e}")
        return jsonify({'error': '파일 서빙 중 오류가 발생했습니다.'}), 500

@app.route('/generate', methods=['POST'])
def generate_image():
    try:
        prompt = request.form.get('prompt', '').strip()
        if not prompt:
            return jsonify({'error': '프롬프트를 입력해주세요.'}), 400

        parts = [{"text": f"Image generation prompt: {prompt}"}]
        uploaded_images = []
        
        for i in range(1, 3):
            file_key = f'image{i}'
            if file_key in request.files:
                file = request.files[file_key]
                if file.filename and file.content_type.startswith("image/"):
                    image_bytes = file.read()
                    base64_image = base64.b64encode(image_bytes).decode("utf-8")
                    
                    parts.append({
                        "inlineData": {
                            "mimeType": file.content_type,
                            "data": base64_image
                        }
                    })
                    
                    file_id = f"{str(uuid.uuid4())}.png"
                    file_path = os.path.join(UPLOAD_FOLDER, file_id)
                    with open(file_path, 'wb') as f:
                        f.write(image_bytes)
                    
                    uploaded_images.append({
                        'filename': file.filename,
                        'path': f"/user_content/{file_id}"
                    })

        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"maxOutputTokens": 4000, "temperature": 1},
            "safetySettings": [
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "OFF"}
            ]
        }

        data = send_request_sync(payload)
        response_text = ""
        result_image_path = None

        if "candidates" in data and data["candidates"]:
            for part in data["candidates"][0]["content"]["parts"]:
                if "text" in part:
                    response_text += part["text"] + "\n"
                elif "inlineData" in part:
                    base64_data = part["inlineData"]["data"]
                    image_data = base64.b64decode(base64_data)
                    
                    result_id = f"{str(uuid.uuid4())}.png"
                    result_path = os.path.join(RESULT_FOLDER, result_id)
                    with open(result_path, 'wb') as f:
                        f.write(image_data)
                    result_image_path = f"/user_content/{result_id}"
                    
                    gallery_item = {
                        'id': result_id.replace('.png', ''),
                        'result_image': result_image_path,
                        'prompt': prompt,
                        'uploaded_images': uploaded_images,
                        'response_text': response_text.strip(),
                        'created_at': datetime.now().isoformat(),
                        'likes': 0
                    }
                    image_gallery.append(gallery_item)

        if result_image_path:
            return jsonify({
                'success': True,
                'result_image': result_image_path,
                'response_text': response_text.strip()
            })
        else:
            return jsonify({'error': 'AI로부터 이미지를 받지 못했습니다.'}), 500

    except Exception as e:
        print(f"에러 발생: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'오류 발생: {str(e)}'}), 500

@app.route('/like/<image_id>', methods=['POST'])
def like_image(image_id):
    client_ip = get_client_ip()
    
    if client_ip not in like_records:
        like_records[client_ip] = set()
    
    if image_id in like_records[client_ip]:
        return jsonify({'error': '이미 좋아요를 누른 이미지입니다.', 'already_liked': True}), 400
    
    for item in image_gallery:
        if item['id'] == image_id:
            item['likes'] += 1
            like_records[client_ip].add(image_id)
            return jsonify({
                'success': True, 
                'likes': item['likes'],
                'user_liked': True
            })
    
    return jsonify({'error': '이미지를 찾을 수 없습니다.'}), 404

@app.route('/image/<image_id>')
def get_image_details(image_id):
    client_ip = get_client_ip()
    user_likes = like_records.get(client_ip, set())
    
    for item in image_gallery:
        if item['id'] == image_id:
            item_data = item.copy()
            item_data['user_liked'] = image_id in user_likes
            return jsonify(item_data)
    return jsonify({'error': '이미지를 찾을 수 없습니다.'}), 404

if __name__ == '__main__':
    print("🚀 Flask 앱 시작 중...")
    app.run(host="0.0.0.0", port=7860, debug=True)
