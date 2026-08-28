FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]
