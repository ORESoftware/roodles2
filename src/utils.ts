'use strict';

export type EVCb<T> = (err: any, val?: T) => void;
import * as cp from 'child_process'
import log from './logging';
import * as async from 'async';
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

export const findPathsToWatch = (dir: string, s: Set<string>) : Array<string> => {

  if(s.has(dir)){
    return [];
  }

  s.add(dir);

  try{
    var stats = fs.statSync(dir);
  }
  catch(err){
    log.error('could not call stat on path:', dir);
    log.error(err);
    process.exit(1);
  }

  if(!stats.isDirectory()){
    return [];
  }

  const ret = [dir];
  const items = fs.readdirSync(dir);
  for(const v of items){
    ret.push(...findPathsToWatch(path.resolve(dir + '/' + v), s));
  }
  return ret;
};

export const mustGetEnvVar = (key: string) : string => {
  // const key = 'roodles_stderr_sock';
  const val = process.env[key] || ''; // '/tmp/cp.api.stderr.sock';

  if(!val){
    log.error(`The following env var needs to be defined: '${key}' ...`);
    process.exit(1);
  }

  return val;
};

export const getEnvVar = (key: string) : string => {
  // const key = 'roodles_stderr_sock';
  return process.env[key] || ''; // '/tmp/cp.api.stderr.sock';
};

export const flattenDeep = (a: Array<any>): Array<any> => {
  return a.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
};

export const getAbsPath = (p: string, projectRoot: string) => {
  return path.isAbsolute(p) ? p : path.resolve(projectRoot + '/' + p);
};

export const killProcs = (pid: number, signal: 'KILL' | 'INT', cb: EVCb<any>) => {

  getChildPids(pid, (err, results) => {

    if (err) {
      return cb(err, null);
    }

    if (!results || results.length < 1) {
      return process.nextTick(cb);
    }

    const killer = cp.spawn('bash');
    const cmd = `

        list=( ${results.join(' ')} );

        for v in "\${list[@]}"; do echo "$v"; done | xargs kill -${signal};

        sleep 0.5;

        `;

    log.info('Running command:', chalk.blueBright(cmd));
    killer.stdin.end(cmd);
    killer.stderr.pipe(process.stderr);
    killer.once('exit', (code :any) => {
      if (code > 0) {
        log.warn('Exit code of the following command was non-zero:', cmd);
      }
      cb(null, {});
    });

  });

};

export const getChildPids = (pid: number, cb: EVCb<Array<string>>) => {

  const pidList: Array<string> = [];

  const getMoreData = (pid: string, cb: EVCb<null>) => {

    const k = cp.spawn('bash');
    const cmd = `pgrep -P ${pid}`;
    k.stderr.pipe(process.stderr);
    k.stdin.end(cmd);
    let stdout = '';
    k.stdout.on('data', d => {
      stdout += String(d || '').trim();
    });

    k.once('exit', (code: any) => {

      if (Number.isInteger(code) && code > 0) {
        log.warning('The following command exited with non-zero code:', code, cmd);
      }

      const list = String(stdout).split(/\s+/)
        .map(v => String(v || '').trim())
        .filter(Boolean);

      if (list.length < 1) {
        return cb(null, null);
      }

      for (let v of list) {
        pidList.push(v);
      }

      async.eachLimit(list, 3, getMoreData, cb);

    });
  };

  getMoreData(String(pid), err => {
    cb(err, pidList);
  });

};

