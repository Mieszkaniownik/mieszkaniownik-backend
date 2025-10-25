FROM gcr.io/cloud-builders/kubectl

ENV HELM_VERSION=v3.13.3
RUN wget https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz && \
    tar -zxvf helm-${HELM_VERSION}-linux-amd64.tar.gz && \
    mv linux-amd64/helm /usr/local/bin/helm && \
    rm -rf helm-${HELM_VERSION}-linux-amd64.tar.gz linux-amd64

ENTRYPOINT ["/usr/local/bin/helm"]
