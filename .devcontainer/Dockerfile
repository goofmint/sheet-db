# x64プラットフォームで明示的に動かすためのnodeイメージ（amd64指定）
ARG VARIANT=20
FROM --platform=linux/amd64 node:${VARIANT}-slim

# 必要に応じて git や curl などインストール
RUN apt-get update && apt-get install -y \
  git curl ca-certificates \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリ
WORKDIR /workspaces/app

EXPOSE 8787

USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=/home/node/.npm-global/bin:$PATH

RUN mkdir -p /home/node/.npm-global && npm config set prefix /home/node/.npm-global
