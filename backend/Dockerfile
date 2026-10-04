# Backend image: Spring Boot on Java 21. Translation calls the OpenAI and Anthropic APIs (PLAN.md §28).
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B -DskipTests package && cp target/tenno-talk-backend-*.jar /app.jar

FROM eclipse-temurin:21-jre
# curl only for the health check.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 tenno && mkdir -p /data/media && chown -R tenno /data
USER tenno
WORKDIR /home/tenno
COPY --from=build /app.jar /app/app.jar
ENV MEDIA_ROOT=/data/media \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD curl -fsS http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
