document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('imageForm');
    const generateBtn = document.getElementById('generateBtn');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    const galleryBtn = document.getElementById('galleryBtn');

    // 갤러리 버튼
    galleryBtn.addEventListener('click', function() {
        window.location.href = '/gallery';
    });

    // 이미지 미리보기
    document.getElementById('image1').addEventListener('change', function(e) {
        previewImage(e.target, 'preview1');
    });

    document.getElementById('image2').addEventListener('change', function(e) {
        previewImage(e.target, 'preview2');
    });

    // 폼 제출
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        generateBtn.disabled = true;
        loading.style.display = 'block';
        result.style.display = 'none';

        const formData = new FormData(form);

        try {
            console.log('요청 전송 중...');
            const response = await fetch('/generate', {
                method: 'POST',
                body: formData
            });

            console.log('응답 상태:', response.status);
            console.log('응답 Content-Type:', response.headers.get('content-type'));

            // 응답이 JSON인지 확인
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('JSON이 아닌 응답을 받았습니다:', text.substring(0, 200));
                throw new Error('서버에서 예상치 못한 응답을 반환했습니다. 콘솔을 확인해주세요.');
            }

            const data = await response.json();

            if (data.success) {
                document.getElementById('resultImage').src = data.result_image;
                document.getElementById('resultText').textContent = data.response_text || 'AI가 이미지를 생성했습니다.';
                result.style.display = 'block';
            } else {
                alert('오류: ' + data.error);
            }
        } catch (error) {
            console.error('요청 오류:', error);
            alert('요청 중 오류가 발생했습니다: ' + error.message);
        } finally {
            loading.style.display = 'none';
            generateBtn.disabled = false;
        }
    });

    function previewImage(input, previewId) {
        const preview = document.getElementById(previewId);
        preview.innerHTML = '';

        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                preview.appendChild(img);
            };
            reader.readAsDataURL(input.files[0]);
        }
    }
});
