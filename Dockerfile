# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
COPY . .
RUN dotnet publish FFRastenfeld.csproj -c Release -o /publish

# Serve Stage – nginx als statischer Webserver
FROM nginx:alpine
COPY --from=build /publish/wwwroot /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80