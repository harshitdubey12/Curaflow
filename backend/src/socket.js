/** @type {import('socket.io').Server | null} */
let ioRef = null;

export function setIo(server) {
  ioRef = server;
}

export function getIo() {
  return ioRef;
}
