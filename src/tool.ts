#!/usr/bin/env node

//core
import cp = require('child_process');
import fs = require('fs');
import path = require('path');
import util = require('util');
import assert = require('assert');

//npm
import chokidar = require('chokidar');
import chalk = require('chalk');
import * as residence from 'residence'

const dashdash = require('dashdash');

//project
import {options} from "./cli-options";
import log from "./logging";
import Timer = NodeJS.Timer;
import {Stream, Writable} from "stream";

const flattenDeep = (a: Array<any>): Array<any> => {
  return a.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
};

export default () => {

  const cwd = process.cwd();

  var parser = dashdash.createParser({options: options});
  try {
    var opts = parser.parse(process.argv);
  }
  catch (e) {
    log.error('error: %s', e.message);
    process.exit(1);
  }

  if (opts.help) {
    var help = parser.help({includeEnv: true}).trimRight();
    log.info('\n');
    log.info('usage: roodles [OPTIONS]\n\n' + 'options:\n' + help + '\n\n');
    process.exit(0);
  }

  if (opts._args.length > 0) {
    log.warn('You supplied too many arguments (should be zero):', chalk.bgCyan.black.bold(JSON.stringify(opts._args)))
    process.exit(1);
  }

  const projectRoot = residence.findProjectRoot(cwd);

  if (!projectRoot) {
    log.warn('Could not find project root given cwd => ', cwd);
    process.exit(1);
  }

  log.info('Your presumed project root:', projectRoot);

  if (opts.verbosity > 1) {
    log.info('\n');
    log.info(chalk.cyan.bold.underline(' => Roodles considers the following to be your project root => '), chalk.cyan('"' + projectRoot + '"'));
  }

  function getAbsPath(p: string) {
    return path.isAbsolute(p) ? p : path.resolve(projectRoot + '/' + p);
  }

  const defaults = {
    verbosity: 2,
    signal: 'SIGINT',
    processArgs: [],
    restartUponChange: true,
    restartUponAddition: false,
    restartUponUnlink: false,
    include: projectRoot,
    exclude: [
      /node_modules/,
      /public/,
      /bower_components/,
      /.git/,
      /.idea/,
      /package.json/,
      /test/
    ]
  };

  try {
    var roodlesConf = require(projectRoot + '/roodles.conf.js');

    if (roodlesConf.processLogPath) {
      roodlesConf.processLogPath = getAbsPath(roodlesConf.processLogPath);
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

  const override = {
    exec: '',
    processLogPath: '',
    signal: '',
    include: [] as Array<string>,
    exclude: [] as Array<string>,
    restartUponChange: true,
    restartUponAddition: true,
    restartUponUnlink: true,
    processArgs: [] as Array<string>,
    verbosity: 1
  };

  if (!roodlesConf.exec) {
    log.error('Roodles needs an "exec" file to run!', 'You can specify one with "exec" in your ' +
      'roodles.conf.js file or you can pass one at the command line with the "--exec" option');
    process.exit(1);
  }

  if (opts.process_log_path) {
    override.processLogPath = getAbsPath(opts.process_log_path);
  }

  if (opts.signal) {
    override.signal = String(opts.signal).trim();
    assert(['SIGINT', 'SIGTERM', 'SIGKILL'].indexOf(String(override.signal).trim()) > -1, ' => Value passed as "signal" ' +
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
      log.error('The property "processArgs" needs to be either an array or string.');
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

  const cache = {
    strm: typeof fs.WriteStream,
    success: false,
    to: <Timer><unknown>null
  };

  const getStdout = (): any => {
    return cache.strm || process.stdout;
  };

  const getStderr = (): any => {
    return cache.strm || process.stderr;
  };

  // var strm, success = false;

  function getStream(force: boolean) {
    if (!(force || cache.success)) {
      return null;
    }
    return fs.createWriteStream(mergedroodlesConf.processLogPath, {autoClose: true})
      .once('error', function (err) {
        log.newline();
        log.error(chalk.red.bold(err.message));
        log.warn(' => You may have accidentally used a path for "exec" or "processLogPath" that begins with "/" => \n' +
          ' if your relative path begins with "/" then you should remove that.');
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
      log.error(err.message);
      log.error(
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

  const exclude = flattenDeep([mergedroodlesConf.exclude]);
  const joined = exclude.join('|');
  const rgx = new RegExp('(' + joined + ')');

  if (mergedroodlesConf.verbosity > 1) {
    log.info(chalk.cyan('Roodles will ignore paths that match any of the following => '));
    exclude.forEach(function (p) {
      log.info('=> ', chalk.grey(p));
    });
  }

  const include = flattenDeep([mergedroodlesConf.include]);

  if(include.length < 1){
    log.error('No folders/files to watch.');
    log.error('Please specify which folders to watch in the "include" array in your roodles.conf.js file.');
    process.exit(1);
  }

  for(const v of include){
    try{
      fs.statSync(getAbsPath(v))
    }
    catch (e) {
      log.error('Could not stat the following file:', v);
      // process.exit(1);
    }
  }

  const watcher = chokidar.watch(include, {
    ignored: rgx,
    persistent: true,
    ignoreInitial: true,
  });

  let first = true;

  watcher.once('ready', function () {

    log.warn('Watcher is ready!');

    let count = 0;

    if (mergedroodlesConf.verbosity > 2) {
      log.info('\n', chalk.magenta('  watched paths => '));
    }

    const watched = watcher.getWatched();

    console.log('watched:', watched);

    Object.keys(watched).forEach(function (k) {
      const values = watched[k];
      values.forEach(function (p) {
        count++;
        if (mergedroodlesConf.verbosity > 2) {
          log.info(chalk.grey(path.resolve(k + '/' + p)));
        }
      })
    });

    if (mergedroodlesConf.verbosity > 1) {
      log.info('\n', '  Total number of watched paths => ', count, '\n');
    }

    function launch() {

      log.newline();

      if (first) {
        log.info(chalk.cyan('Roodles is now starting your process...and will restart ' +
          'your process upon file changes.'), '\n');
        if (mergedroodlesConf.verbosity > 1) {
          log.info('  Your process will be launced with the following command => "' + mergedroodlesConf.exec +
            ' ' + mergedroodlesConf.processArgs.join(' ') + '"', '\n');
        }
      }
      else {
        log.warn(chalk.black.bold('Roodles is re-starting your process...'));
      }

      cache.strm = getStream(false) as any;

      const n = cp.spawn('bash');

      n.stdin.end(
        `${mergedroodlesConf.exec} ${mergedroodlesConf.processArgs.join(' ')}`
      );

      if (mergedroodlesConf.verbosity > 1 && first) {
        log.info('Your process is running with pid => ', n.pid);
      }

      if (mergedroodlesConf.verbosity > 1 && first && !cache.strm) {
        log.info('What follows is the stdout/stderr of your process => ', '\n');
      }

      first = false;

      n.on('error', err => {
        log.warn('spawn error:', err.stack || err);
      });

      n.once('exit', code => {
        if (!(n as any).isRoodlesKilled) {
          log.warn(`Looks like your process crashed (with code ${code})`);
          log.warn(`...waiting for file changes before restarting.`);
        }
      });

      n.stdout.setEncoding('utf8');
      n.stderr.setEncoding('utf8');
      n.stdout.pipe(getStdout(), {end: true});
      n.stderr.pipe(getStderr(), {end: true});

      n.stderr.on('data', d => {
        if (String(d).match(/error/i)) {
          const stck = String(d).split('\n').filter(function (s, index) {
            return index < 3 || (!String(s).match(/\/node_modules\//) && String(s).match(/\//));
          });
          const joined = stck.join('\n');
          console.error('\n');
          console.error(chalk.bgRed.white(' => captured stderr from your process => '));
          console.error(chalk.red.bold(joined));
          log.info('\n');
        }
      });

      return n;
    }

    let k = launch();

    // let globalTo = <Timer><unknown>null;

    function killAndRestart(timeout: number) {

      clearTimeout(cache.to);
      cache.to = setTimeout(() => {
        const to = setTimeout(onClose, 500);
        k.once('exit', onClose);

        function onClose() {
          clearTimeout(to);
          k.removeAllListeners();
          k.unref();
          k = launch();
          if (mergedroodlesConf.verbosity > 1) {
            log.info('Process restarted, new process pid => ', k.pid);
          }
        }

        if (mergedroodlesConf.verbosity > 2) {
          log.warn('Killing your process with the "' + mergedroodlesConf.signal + '" signal.');
        }

        (k as any).isRoodlesKilled = true;
        k.kill(mergedroodlesConf.signal);

      }, timeout);

    }

    process.stdin.resume()
      .setEncoding('utf8')
      .on('data', d => {
        if (String(d || '').trim() === 'rs') {
          if (mergedroodlesConf.verbosity > 1) {
            log.info(' => "rs" captured...');
          }
          killAndRestart(0);
        }
      });

    if (true || mergedroodlesConf.restartUponChange) {
      watcher.on('change', path => {
        log.info('watched file changed => ', path);
        killAndRestart(500);
      });
    }

    if (true || mergedroodlesConf.restartUponAddition) {
      watcher.on('add', path => {
        log.info('file within watched path was added => ', path);
        killAndRestart(500);
      });
    }

    if (true || mergedroodlesConf.restartUponUnlink) {
      watcher.on('unlink', path => {
        log.info('file within watched path was unlinked => ', path);
        killAndRestart(500);
      });
    }

  });

}