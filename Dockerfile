FROM node:12-alpine

RUN mkdir -p /data
WORKDIR /data

# Copy just the package.json and lock files to avoid
# needing to npm install each time a file is changed
COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json

RUN npm install

# Copy all the files over
COPY . .

CMD ["node", "index.js", "--website", "https://unilever-kilbourn.weeverapps.com"]