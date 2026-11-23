FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 BOT_STATE_DB=/app/data/bot_state.sqlite
WORKDIR /app
EXPOSE 8080
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY bot.py ./bot.py
RUN mkdir -p /app/data && useradd --create-home --uid 10001 bot && chown -R bot:bot /app
USER bot
CMD ["python", "bot.py"]
