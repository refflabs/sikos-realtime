FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Hugging Face Spaces runs on port 7860 by default
EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production
ENV SOCKET_PORT=7860
ENV LARAVEL_API_URL=https://sikos-bpsw.vercel.app/api
ENV SOCKET_SECRET=sikos-realtime-secret
ENV CORS_ORIGIN=https://sikos-two.vercel.app,http://localhost:5173,http://127.0.0.1:5173

CMD ["node", "index.js"]
