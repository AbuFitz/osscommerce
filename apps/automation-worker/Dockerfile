FROM node:22.20.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY apps/automation-worker ./apps/automation-worker
COPY packages ./packages
RUN npm ci --ignore-scripts
ENV NODE_ENV=production
EXPOSE 3200
CMD ["npm", "run", "start", "-w", "@oss-commerce/automation-worker"]
