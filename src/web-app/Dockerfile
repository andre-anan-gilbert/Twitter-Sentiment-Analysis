# Copy application code, install dependencies and build source code
FROM node:slim AS builder
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

# Production image
FROM node:slim
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

# Copy neccessary files and packages to run application
COPY --from=builder /app/public/style.css ./public/style.css
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./

# Only install production dependencies, no dev dependencies will be added
RUN npm install

# Export app port and set entrypoint at startup
EXPOSE 3000
ENTRYPOINT ["node", "index.js"]
CMD [""]
