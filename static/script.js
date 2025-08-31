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
            const response = await fetch('/generate', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('resultImage').src = data.result_image;
                document.getElementById('resultText').textContent = data.response_text || 'AI가 이미지를 생성했습니다.';
                result.style.display = 'block';
            } else {
                alert('오류: ' + data.error);
            }
        } catch (error) {
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
