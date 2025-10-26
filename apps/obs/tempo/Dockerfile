FROM grafana/tempo:2.4.2
COPY tempo.yaml /etc/tempo.yaml
ENTRYPOINT ["/tempo","-config.file=/etc/tempo.yaml"]
