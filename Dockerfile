FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose Socket.IO port
EXPOSE 3001

# Set environment to production
ENV NODE_ENV=production

# Start Socket.IO server
CMD ["npm", "run", "start:socket"]
