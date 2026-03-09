# Build the Docker image
docker build --build-arg VITE_API_BASE_URL=https://intesahrapi.condaverse.com -f Dockerfile.build -t react-builder .

# Create a container from the image
docker create --name temp-container react-builder

# Copy the dist folder to the host machine
rm -rf ./dist
docker cp temp-container:/app/dist ./dist

# Clean up the temporary container
docker rm temp-container
docker-compose restart intesahr-ui