# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
COPY . .
RUN dotnet publish FFRastenfeld.csproj -c Release -o /client
RUN dotnet publish AdminServer/FFRastenfeld.AdminServer.csproj -c Release -o /server \
    && mkdir -p /server/wwwroot \
    && cp -a /client/wwwroot/. /server/wwwroot/

# Serve Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app
COPY --from=build /server .
ENV ClientRoot=/app/wwwroot
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet FFRastenfeld.AdminServer.dll"]
