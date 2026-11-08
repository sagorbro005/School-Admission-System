FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Api/Admission.csproj Api/
RUN dotnet restore Api/Admission.csproj
COPY Api/ Api/
RUN dotnet publish Api/Admission.csproj -c Release -o /published --no-restore

FROM build AS tests
COPY Tests/ Tests/
RUN dotnet build Tests/Admission.Tests.csproj -c Release
ENTRYPOINT ["dotnet","test","Tests/Admission.Tests.csproj","-c","Release","--no-build"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /published .
ENV ASPNETCORE_URLS=http://+:8080
USER app
ENTRYPOINT ["dotnet","Admission.dll"]
