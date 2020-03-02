'use strict';

import * as fs from 'fs';
import * as net from "net";
import log from "./logging";

type Conns = {
  stdoutConnections: Set<net.Socket>,
  stderrConnections:  Set<net.Socket>,
  metaConnections:  Set<net.Socket>
}

export const launchServers =  (cache: any, {stdoutConnections, stderrConnections, metaConnections}: Conns) => {

  {
    const stdoutSock = '/tmp/cp.api.stdout.sock';

    try {
      fs.unlinkSync(stdoutSock)
    }
    catch (err) {
      // console.warn(err);
    }

    const stdoutServer = net.createServer(s => {

      stdoutConnections.add(s);

      if (cache.state === 'LIVE') {
        if (cache.k) {
          cache.k.stdout.pipe(s, {end: false});
        }
        else {
          log.warn('process state is "LIVE" but cache.k was not defined.')
        }
      }

      s.once('disconnect', () => {
        stdoutConnections.delete(s);
      });
      s.once('error', () => {
        stdoutConnections.delete(s);
      });
      s.once('end', () => {
        stdoutConnections.delete(s);
      });

    });

    stdoutServer.listen(stdoutSock, () => {
      log.info('uds stdout server listening on:', stdoutSock)
    });
  }

  {

    const stderrSock = '/tmp/cp.api.stderr.sock';

    try {
      fs.unlinkSync(stderrSock)
    }
    catch (err) {
      // console.warn(err);
    }

    const stderrServer = net.createServer(s => {

      stderrConnections.add(s);

      if (cache.state === 'LIVE') {
        if (cache.k) {
          cache.k.stderr.pipe(s, {end: false});
        }
        else {
          log.warn('process state is "LIVE" but cache.k was not defined.')
        }
      }

      s.once('disconnect', () => {
        stderrConnections.delete(s);
      });
      s.once('error', () => {
        stderrConnections.delete(s);
      });
      s.once('end', () => {
        stderrConnections.delete(s);
      });

    });

    stderrServer.listen(stderrSock, () => {
      log.info('uds stderr server listening on:', stderrSock)
    });
  }


  {

    const metaSock = '/tmp/cp.api.meta.sock';

    try {
      fs.unlinkSync(metaSock)
    }
    catch (err) {
      // console.warn(err);
    }

    const metaServer = net.createServer(s => {

      metaConnections.add(s);

      s.once('disconnect', () => {
        metaConnections.delete(s);
      });
      s.once('error', () => {
        metaConnections.delete(s);
      });
      s.once('end', () => {
        metaConnections.delete(s);
      });

    });

    metaServer.listen(metaSock, () => {
      log.info('uds meta server listening on:', metaSock)
    });
  }

}