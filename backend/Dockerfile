FROM python:3.11-slim

WORKDIR /app

# Bağımlılıkları önce kopyala — cache'den yararlan
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kaynak kodu kopyala
COPY . .

# Üretim ortamı için güvenli defaults
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
