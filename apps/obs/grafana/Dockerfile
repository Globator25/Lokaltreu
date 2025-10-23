FROM grafana/grafana:latest

# Alles entfernen, inkl. evtl. mitgelieferter Beispiel-Dateien
RUN rm -rf /etc/grafana/provisioning/datasources/* /etc/grafana/provisioning/dashboards/*

# Deine Dateien kopieren
COPY provisioning/ /etc/grafana/provisioning/
COPY dashboards/ /var/lib/grafana/dashboards/

# Sicherstellen, dass KEINE fremde datasource(s).yaml liegt und nur eine Default-Flag vorkommt
RUN rm -f /etc/grafana/provisioning/datasources/datasource.yaml /etc/grafana/provisioning/datasources/datasources.yaml \
 && echo "--- Files in /etc/grafana/provisioning/datasources:" \
 && ls -la /etc/grafana/provisioning/datasources \
 && echo "--- Defaults found:" \
 && (grep -Rni 'isDefault:\s*true' /etc/grafana/provisioning/datasources || true)
