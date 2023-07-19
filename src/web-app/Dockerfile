# Install dependencies only when needed
FROM node:slim AS deps
WORKDIR /app
COPY package*.json .
RUN npm install

# Rebuild the source code only when needed
FROM node:slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run app
FROM node:slim
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

COPY --from=builder /app/style.css ./public/style.css
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./

RUN npm install --only=production

# Export app port and set entrypoint at startup
EXPOSE 3000
ENTRYPOINT ["node", "index.js"]
CMD [""]
