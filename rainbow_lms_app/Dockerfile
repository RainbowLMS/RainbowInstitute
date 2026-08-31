FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "--no-warnings", "server.js"]
