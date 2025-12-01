FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json ./

RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:18-alpine as production

WORKDIR /app 

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

RUN npm install --production --legacy-peer-deps

EXPOSE 3021

CMD ["node", "dist/main.js"]