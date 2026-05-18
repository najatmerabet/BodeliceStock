FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN rm -rf node_modules/@prisma/client
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]