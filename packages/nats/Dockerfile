FROM nats:2.10-alpine
COPY packages/nats/nats-server.conf /etc/nats/nats-server.conf
EXPOSE 10000 4222 8222
CMD ["nats-server", "-c", "/etc/nats/nats-server.conf"]
