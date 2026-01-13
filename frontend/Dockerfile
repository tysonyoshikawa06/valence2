FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy application code INCLUDING public directory
COPY . .

# Build Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start Next.js
CMD ["npm", "start"]