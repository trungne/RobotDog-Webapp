#!/bin/bash

# Build the project
echo "Building the project..."
yarn build

# Rename js files
echo "Renaming js file..."
mv dist/assets/*.js dist/scripts.js

# Rename css files
echo "Renaming css file..."
mv dist/assets/*.css dist/styles.css

rm -rf dist/assets


# Create new index.html
echo "Creating new index.html..."
cat > dist/index.html <<EOF
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ESP32 Webapp</title>
    <script type="module" crossorigin src="scripts.js"></script>
    <link rel="stylesheet" crossorigin href="styles.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
EOF

# Create data folder

echo "Creating data folder..."
rm -rf data
mkdir data
cp -r dist/* data

rm data/vite.svg
