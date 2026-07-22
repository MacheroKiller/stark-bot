# Use the official Bun image with version 1.2.1
FROM oven/bun:1.2.1

# Set the working directory inside the container
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN bun install

# Start the application
CMD ["bun", "src/main.ts"]