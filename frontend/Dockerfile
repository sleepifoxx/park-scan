# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy only the package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Build the Next.js app
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose the port Next.js will run on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
