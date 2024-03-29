#!/usr/bin/env node

//core
import * as cp from 'child_process'
import fs = require('fs');
import path = require('path');
import util = require('util');
import assert = require('assert');
import * as stdio from 'json-stdio';

//npm
import chalk = require('chalk');
import * as residence from 'residence'

const dashdash = require('dashdash');

//project
import * as utils from './utils'
import {options} from "./cli-options";
import log from "./logging";
import Timer = NodeJS.Timer;
import JSONParser from "@oresoftware/json-stream-parser";
import * as net from 'net';
import {getDefaultConf, getOverride} from "./default-conf";
import {launchServers} from "./socket-servers";
import {getAbsPath} from "./utils";

export default () => {

  const cache = {
    strm: typeof fs.WriteStream,
    success: false,
    to: <Timer><unknown>null,
    k: <unknown>null as cp.ChildProcess,
    state: 'DEAD' as 'LIVE' | 'DEAD'
  };

  const cwd = process.cwd();
  const stdoutConnections = new Set<net.Socket>();
  const stderrConnections = new Set<net.Socket>();
  const metaConnections = new Set<net.Socket>();

  let gp = Promise.resolve();

  launchServers(cache, {
    stderrConnections,
    stdoutConnections,
    metaConnections
  }).then(ee => {

    const parser = dashdash.createParser({options: options});
    try {
      var opts = parser.parse(process.argv);
    }
    catch (e) {
      log.error("4c932a52-953f-4548-b36f-4e171ec49803", 'error:', e);
      process.exit(1);
    }

    if (opts.help) {
      var help = parser.help({includeEnv: true}).trimRight();
      log.newline();
      log.info('usage: roodles [OPTIONS]\n\n' + 'options:\n' + help + '\n\n');
      process.exit(0);
    }

    if (opts._args.length > 0) {
      log.warn('You supplied too many arguments (should be zero):', chalk.bgCyan.black.bold(JSON.stringify(opts._args)))
      process.exit(1);
    }

    const projectRoot = residence.findRootDir(cwd, 'roodles.conf.js');

    if (!projectRoot) {
      log.warn('Could not find project root given cwd => ', cwd);
      process.exit(1);
    }

    log.info('Your presumed project root:', projectRoot);

    if (opts.verbosity > 1) {
      log.info('\n');
      log.info(chalk.cyan.bold.underline(' => Roodles considers the following to be your project root => '), chalk.cyan('"' + projectRoot + '"'));
    }

    const defaults = getDefaultConf(projectRoot);

    try {
      var roodlesConf = require(projectRoot + '/roodles.conf.js');

      if (roodlesConf.processLogPath) {
        roodlesConf.processLogPath = utils.getAbsPath(roodlesConf.processLogPath, projectRoot);
      }

      // if (roodlesConf.exec) {
      //   roodlesConf.exec = getAbsPath(roodlesConf.exec);
      // }

    }
    catch (err) {
      log.warn('Could not find roodles.conf.js');
      roodlesConf = {};
    }

    log.info('config:', roodlesConf);
    const override = getOverride();

    if (!roodlesConf.exec) {
      log.error("63c02af3-a9ad-4571-9a51-fdc30230fe5f", 'Roodles needs an "exec" file to run!', 'You can specify one with "exec" in your ' +
        'roodles.conf.js file or you can pass one at the command line with the "--exec" option');
      process.exit(1);
    }

    if (opts.process_log_path) {
      override.processLogPath = utils.getAbsPath(opts.process_log_path, projectRoot);
    }

    if (opts.signal) {
      override.signal = String(opts.signal).trim();
      assert(['SIGINT', 'SIGTERM', 'SIGKILL'].indexOf(String(override.signal).trim()) > -1,
        ' => Value passed as "signal" ' +
        'option needs to be one of {"SIGINT","SIGTERM","SIGKILL"},\nyou passed => "' + override.signal + '".');
    }

    if (opts.include) {
      override.include = opts.include;
    }

    if (opts.exclude) {
      override.exclude = opts.exclude;
    }

    if (opts.process_args) {
      if (Array.isArray(opts.process_args)) {
        override.processArgs = opts.process_args;
      }
      else if (typeof opts.process_args === 'string') {
        override.processArgs = String(opts.process_args).trim().split(/\s+/)
      }
      else {
        log.error("921b42af-8f54-4e24-b700-0a0a54d2370f", 'The property "processArgs" needs to be either an array or string.');
        process.exit(1);
      }
    }

    if ('restart_upon_change' in opts) {
      override.restartUponChange = opts.restart_upon_change;
    }

    if ('restart_upon_addition' in opts) {
      override.restartUponAddition = opts.restart_upon_addition;
    }

    if ('restart_upon_unlink' in opts) {
      override.restartUponUnlink = opts.restart_upon_unlink;
    }

    if (opts.verbosity) {
      override.verbosity = opts.verbosity;
    }

    const mergedroodlesConf = Object.assign(defaults, override, roodlesConf);

    console.log({mergedroodlesConf});

    const targetPortRaw = utils.getEnvVar('roodles_target_port');

    const portsToKill = Array.from(
      new Set(
        utils.flattenDeep([targetPortRaw, mergedroodlesConf.portsUsed]).filter(Boolean)
      )
    );

    // const getStdout = (): any => {
    //   return cache.strm || process.stdout;
    // };
    //
    // const getStderr = (): any => {
    //   return cache.strm || process.stderr;
    // };

    // var strm, success = false;

    function getStream(force: boolean) {
      // if (!(force || cache.success)) {
      //   return null;
      // }
      if (!mergedroodlesConf.processLogPath) {
        return null;
      }
      return fs.createWriteStream(mergedroodlesConf.processLogPath, {autoClose: true})
        .once('error', err => {
          log.newline();
          log.error("873fefc5-76cb-43c4-84f4-4b4777408ecb", chalk.red.bold(err.message));
          // log.warn(' => You may have accidentally used a path for "exec" or "processLogPath" that begins with "/" => \n' +
          //   ' if your relative path begins with "/" then you should remove that.');
          throw err;
        });
    }

    if (mergedroodlesConf.processLogPath) {
      // try {
      //   fs.statSync($roodlesConf.processLogPath);
      // }
      // catch (err) {
      //   console.error(chalk.yellow.bold(' Warning => Log path was not found on the filesystem =>'), '\n',
      //     $roodlesConf.processLogPath);
      // }

      try {
        cache.strm = getStream(true) as any;
        cache.success = true;
        if (mergedroodlesConf.verbosity > 1) {
          log.info(
            'Your process stdout/stderr will be sent to the log file at path:',
            mergedroodlesConf.processLogPath
          );
        }
      }
      catch (err) {
        log.error("407c9656-9ccc-4d65-9b6f-d20eb4a64000", err);
        log.error(
          "3ecadbd2-a67a-4e69-b625-6b8c44a4e7eb",
          ' => You may have accidentally used an absolute path for "exec" or "processLogPath",',
          'if your relative path begins with "/" then you should remove that.'
        );
        process.exit(1)
      }

    }

    // try {
    //   if (!fs.statSync(mergedroodlesConf.exec).isFile()) {
    //     throw ' => "exec" option value is not a file'
    //   }
    // }
    // catch (err) {
    //   throw  err;
    // }

    if (mergedroodlesConf.verbosity > 1) {
      log.newline();
      log.info(chalk.green.bold('Here is your combined roodles configuration given (1) roodles defaults ' +
        '(2) roodles.conf.js and (3) your command line arguments => '));
      log.info(chalk.green(util.inspect(mergedroodlesConf)));
    }

    const exclude = utils.flattenDeep([mergedroodlesConf.exclude]);
    // const joined = exclude.join('|');
    // const rgx = new RegExp('(' + joined + ')');

    if (mergedroodlesConf.verbosity > 1) {
      log.info(chalk.cyan('Roodles will ignore paths that match any of the following => '));
      exclude.forEach(function (p) {
        log.info('=> ', chalk.grey(p));
      });
    }

    const include = Array.from(
      new Set(
        utils.flattenDeep([mergedroodlesConf.include])
      )
    );

    if (include.length < 1) {
      log.error("b6cc3289-54ea-45f3-88ce-90297219461d", 'No folders/files to watch.');
      log.error('Please specify which folders to watch in the "include" array in your roodles.conf.js file.');
      process.exit(1);
    }

    for (const v of include) {
      try {
        fs.statSync(utils.getAbsPath(v, projectRoot))
      }
      catch (e) {
        log.error("93b92561-540d-4036-80f4-6f6a89444758",  'Could not stat the following file path we were supposed to watch:', v);
        process.exit(1);
      }
    }


    let first = true;

    const onReady = () => {

      log.info('Watcher is ready!');

      let count = 0;


      if (mergedroodlesConf.verbosity > 1) {
        log.info('Total number of watched paths => ', count, '\n');
      }

      function launch() {

        log.newline();

        if (cache.k) {
          cache.k.removeAllListeners();
          if(cache.k.stdout){
            cache.k.stdout.removeAllListeners();
          }
          if(cache.k.stderr){
            cache.k.stderr.removeAllListeners();
          }
        }

        if (first) {
          log.info(chalk.cyan('Roodles is now starting your process...and will restart ' +
            'your process upon file changes.'), '\n');
          if (mergedroodlesConf.verbosity > 1) {
            log.info('  Your process will be launced with the following command => "' + mergedroodlesConf.exec +
              ' ' + mergedroodlesConf.processArgs.join(' ') + '"', '\n');
          }
        }
        else {
          log.info('Roodles is re-starting your process...');
        }

        cache.strm = getStream(false) as any;

        const n = cp.spawn('bash'); //  ['--','--roodles']

        n.stdin.end(
          `${mergedroodlesConf.exec} ${mergedroodlesConf.processArgs.join(' ')}`
        );

        if(stderrConnections.size < 1 || stdoutConnections.size < 1){
          if(false){
            n.stdout.pipe(process.stdout);
            n.stderr.pipe(process.stderr);
          }
        }

        if (mergedroodlesConf.verbosity > 1 && first) {
          log.info('Your process is running with pid => ', n.pid);
        }

        if (mergedroodlesConf.verbosity > 1 && first && !cache.strm) {
          log.info('What follows is the stdout/stderr of your process => ', '\n');
        }

        first = false;

        n.on('error', err => {
          log.warn('spawn error:', err);
        });

        n.once('exit', (code: any) => {
          if (code > 0) {
            for (const c of metaConnections) {
              c.writable && c.write('crashed\n');
            }
          }

          n.stdout.unpipe(process.stdout);
          n.stderr.unpipe(process.stderr);

          console.log('size on exit:', metaConnections.size, stdoutConnections.size, stderrConnections.size)

          for (const c of stdoutConnections) {
            n.stdout.unpipe(c)
          }

          for (const c of stderrConnections) {
            n.stderr.unpipe(c)
          }

          n.removeAllListeners();

          if (!(n as any).isRoodlesKilled) {
            log.warn(`Looks like your process crashed (with code ${code})`);
            log.warn(`...waiting for file changes before restarting.`);
          }
        });

        n.stdout.setEncoding('utf8');
        n.stderr.setEncoding('utf8');


        console.log('on create cp:', metaConnections.size, stdoutConnections.size, stderrConnections.size)

        for (const c of metaConnections) {
          c.writable && c.write('clear\n');
        }

        for (const c of stdoutConnections) {

          if (!c.writable) {
            continue;
          }

          n.stdout.pipe(c, {end: false})

            // .once('end', () => {
            //   p.unpipe();
            //   p.removeAllListeners();
            // })
            // .once('error', e => {
            //   log.warn('pipe error to stdout conn:', e);
            //   p.unpipe();
            //   p.removeAllListeners();
            // });
        }

        for (const c of stderrConnections) {
          if (!c.writable) {
            continue;
          }

          n.stderr.pipe(c, {end: false})
            // .once('end', () => {
            //   p.unpipe();
            //   p.removeAllListeners();
            // })
            // .once('error', e => {
            //   log.warn('pipe error to stderr conn:', e);
            //   p.unpipe();
            //   p.removeAllListeners();
            // });
        }

        // n.stdout.pipe(getStdout(), {end: true});
        // n.stderr.pipe(getStderr(), {end: true});

        const p1 = new JSONParser();
        const p = n.stdout.pipe(p1, {end: false}).on('data', listener);

        function listener(d: any) {
          if (d && d.server_state === 'listening') {
            p.removeListener('data', listener);
            p1.removeListener('data', listener);
            cache.state = 'LIVE';
            stdio.log({state: 'LIVE'});
          }
        }

        n.stderr.on('data', d => {
          if (String(d).match(/error/i)) {
            const stck = String(d).split('\n').filter(function (s, index) {
              return index < 3 || (!String(s).match(/\/node_modules\//) && String(s).match(/\//));
            });
            const joined = stck.join('\n');
            console.error('\n');
            console.error("842a264e-2815-4d5a-8e30-374456ebc1d0:")
            console.error(chalk.bgRed.white('captured stderr from your process => '));
            console.error(chalk.red.bold(joined));
          }
        });

        if (mergedroodlesConf.verbosity > 1) {
          log.info('Process restarted, new process pid => ', cache.k.pid);
        }

        return n;
      }

      cache.k = launch();

      // let globalTo = <Timer><unknown>null;

      function killAndRestart(timeout: number) {

        clearTimeout(cache.to);
        cache.to = setTimeout(() => {

          const c = cache.k;

          gp = gp.then(() => {

            let exited = false;
            // let timedout = false;
            let callable = true;
            ee.removeAllListeners();

            let connCount = 0;

            cache.state = 'DEAD';
            stdio.log({state: 'DEAD'});

            const listener = () => {
              if (++connCount === 3) {
                onExitOrTimeout();
              }
            };

            ee.on('connected', listener);

            const to = setTimeout(() => {
              log.warn('wait for exit timed out...');
              // timedout = true;
              if (!exited) {
                onExitOrTimeout();
              }

            }, 2500);

            c.once('exit', (code: any) => {
              exited = true;
              log.info('bash proc exitted with code:', code);
            });

            function onExitOrTimeout() {
              if (!callable) {
                return;
              }
              ee.removeListener('connected', listener);
              callable = false;
              clearTimeout(to);
              if(c.stdout){
                c.stdout.removeAllListeners();
              }
              if(c.stderr){
                c.stderr.removeAllListeners();
              }
              c.removeAllListeners();
              c.unref();
              cache.k = launch();
            }

            if (mergedroodlesConf.verbosity > 2) {
              log.warn('Killing your process with the "' + mergedroodlesConf.signal + '" signal.');
            }

            (c as any).isRoodlesKilled = true;
            // process.kill(cache.k.pid, 'SIGINT');
            // cache.k.kill(mergedroodlesConf.signal);

            const proms = [];

            for (const p of portsToKill) {

              proms.push(new Promise((resolve) => {

                const killer = cp.spawn('bash');

                killer.stdin.end(`
                  set +e;
                  lsof -ti tcp:${p} | xargs -r kill -INT
                   sleep 0.25
                   my_pid="$(lsof -ti tcp:${p})"
                   if [[ ! -z "$my_pid" ]]; then
                     sleep 1.5;
                     lsof -ti tcp:${p} | xargs -r kill -KILL
                   fi
             `);

                killer.once('exit', resolve)

              }));

            }

            return Promise.all(proms).then(() => {

              onExitOrTimeout();
              c.kill('SIGINT');
              utils.killProcs(c.pid, 'INT', (err, results) => {
                log.info({err, results});
              });

              // process.kill(c.pid, 'SIGKILL');
              setTimeout(() => {
                if (!exited) {
                  setTimeout(() => {
                    c.kill('SIGKILL');
                  }, 100);
                  utils.killProcs(c.pid, 'KILL', (err, results) => {
                    c.kill('SIGKILL');
                    log.info({err, results});
                  });
                }
              }, 2000);
            });
          })
        }, timeout);

      }

      log.info('beginning to listen to stdin.');
      process.stdin.resume()
        .setEncoding('utf8')
        .on('data', d => {

          const userInput = String(d || '').trim().toLowerCase();

          if (userInput === '') {
            log.warn('(empty user input detected).')
            return;
          }

          if (userInput === 'restart') {
            process.stdout.write('\x1Bc');
            if (mergedroodlesConf.verbosity > 0) {
              log.info(' => "restart" captured...');
            }
            for (const c of metaConnections) {
              c.writable && c.write('closing');
            }
            // we do a hard restart if new files are added
            process.exit(0);
            return;
          }

          if (userInput === 'rs') {
            process.stdout.write('\x1Bc');
            if (mergedroodlesConf.verbosity > 0) {
              log.info(' => "rs" captured...');
            }
            for (const c of metaConnections) {
              c.writable && c.write('restarting');
            }
            killAndRestart(0);
            return;
          }

          if (userInput === 'clear') {
            process.stdout.write('\x1Bc');
            return;
          }

          log.warn(`Command not recognized: '${userInput}'`);
        });

      // const f = path.resolve(__dirname + '/test/dist/first.js');

      const pathsToWatch = [];
      const s = new Set<string>(); // prevent cycles if folders are symlinked etc

      const files = [];
      for (let r of include) {

        const v = getAbsPath(r, projectRoot);

        try {
          if (fs.statSync(v).isFile()) {
            files.push(v);
            continue;
          }
        }
        catch (err) {
          log.error("4e8c4593-337d-42e8-ac15-e631632e637a", 'could not call stat on path:', v);
          log.error("f55c1a0e-8086-4a85-b051-8f98a5b212f1", err);
          process.exit(1);
        }

        pathsToWatch.push(...utils.findPathsToWatch(v, s));
      }

      const flattenedPathsSet = new Set(
        utils.flattenDeep(pathsToWatch)
      );

      for (const f of files) {
        const dirname = path.dirname(f);
        if (!flattenedPathsSet.has(dirname)) {
          // if our watcher does not have the immediate dirname/parent of this file
          // then we add it to the set
          flattenedPathsSet.add(f);
        }
      }

      let watchCount = 0;

      let toLocal = <Timer><unknown>null;

      for (const i of Array.from(flattenedPathsSet)) {
        fs.watch(i, (event: string, filename: string) => {
          console.log('hello:', event, filename);
          // log.info('watched file changed => ', path);

          clearTimeout(toLocal);
          toLocal = setTimeout(() => {
            const now = Date.now();
            const localWatchCount = ++watchCount;
            gp.then(() => {
              if (localWatchCount < watchCount) {
                // we have a new change
                return;
              }
              const diff = Date.now() - now;
              killAndRestart(Math.max(1, 200 - diff));
            });
          }, 20);
        });
      }

      return;

      const watcher = cp.spawn('bash');

      const paths = Array.from(flattenedPathsSet).map(v => `-m '${v}'`).join(' ');

      //https://stackoverflow.com/questions/1515730/is-there-a-command-like-watch-or-inotifywait-on-the-mac

      console.log({paths});  //

      watcher.stdin.end(`
               inotifywait ${paths} -e create \
               -e moved_to -e modify -e moved_from \
               -e move -e create -e delete -e delete_self
      `);

      watcher.stdout.on('data', d => {
        console.log('watcher stdout:', String(d));

        clearTimeout(toLocal);

        toLocal = setTimeout(() => {
          const now = Date.now();
          const localWatchCount = ++watchCount;
          gp.then(() => {
            if (localWatchCount < watchCount) {
              // we have a new change
              return;
            }
            const diff = Date.now() - now;
            killAndRestart(Math.max(1, 200 - diff));
          });
        }, 20);

      });

      // const w = fs.watchFile(f, {interval: 40}, (prev, curr) => {
      //   console.log('hello:');
      //   // log.info('watched file changed => ', path);
      //   killAndRestart(500);
      // });

    };

    onReady();

    // w.on('change', p => {
    //   console.log('change to:', p);
    // });

    // if (true || mergedroodlesConf.restartUponChange) {
    //   watcher.on('change', path => {
    //     log.info('watched file changed => ', path);
    //     killAndRestart(500);
    //   });
    // }
    //
    // if (true || mergedroodlesConf.restartUponAddition) {
    //   watcher.on('add', path => {
    //     log.info('file within watched path was added => ', path);
    //     killAndRestart(500);
    //   });
    // }
    //
    // if (true || mergedroodlesConf.restartUponUnlink) {
    //   watcher.on('unlink', path => {
    //     log.info('file within watched path was unlinked => ', path);
    //     killAndRestart(500);
    //   });
    // }
  });
}
