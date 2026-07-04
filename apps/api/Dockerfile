FROM python:3.11-slim

WORKDIR /app

# Instala dependências separado do código para aproveitar cache de layer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# WORKERS: número de processos Uvicorn (padrão 2; ajuste via env WEB_CONCURRENCY)
# pool_pre_ping no SQLAlchemy cuida de conexões mortas entre workers
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips='*'"]
