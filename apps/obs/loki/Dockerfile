FROM grafana/loki:2.9.5
COPY loki-config.yaml /etc/loki/loki-config.yaml
ENTRYPOINT ["/usr/bin/loki","-config.file=/etc/loki/loki-config.yaml"]
