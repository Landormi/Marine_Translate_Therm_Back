FROM nginx

COPY docker-dev.vliz.be.cnf docker-dev.vliz.be.cnf

RUN openssl req -x509 -nodes -days 5 \
    -newkey rsa:2048 \
    -keyout /etc/ssl/private/www.docker-dev.vliz.be.key \
    -out /etc/ssl/certs/www.docker-dev.vliz.be.crt \
    -config docker-dev.vliz.be.cnf

# This takes a while to run:
# RUN openssl dhparam -out /etc/nginx/dhparam.pem 4096

COPY nginx.conf /etc/nginx/conf.d/docker-dev.vliz.be.conf
