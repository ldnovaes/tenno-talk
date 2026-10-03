# Backend image: Spring Boot on Java 21 + the ChatGPT (codex) and Claude CLIs used as translators (PLAN.md §28).
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B -DskipTests package && cp target/tenno-talk-backend-*.jar /app.jar

FROM eclipse-temurin:21-jre
# Node only to run the AI CLIs; they log in with the plan subscriptions, never API keys.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g @openai/codex @anthropic-ai/claude-code \
 && npm cache clean --force \
 && apt-get purge -y gnupg && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 tenno && mkdir -p /data/media && chown -R tenno /data
USER tenno
WORKDIR /home/tenno
COPY --from=build /app.jar /app/app.jar
ENV MEDIA_ROOT=/data/media \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD curl -fsS http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
