# Use Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy all files into the container
COPY . .

# Install dependencies
RUN npm install express mysql2 body-parser

# Expose port 80
EXPOSE 80

# Run the server
CMD ["node", "server.js"]
