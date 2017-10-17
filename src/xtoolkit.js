const fs = require('fs');
const Command = require('./Command');
const Argv = require('./Argv');
const chalk = require('chalk');
const config = require('./util/config');
const installer = require('./installer');
const path = require('path');
class XToolkit {
  constructor () {
    this.begin = false;
    this._commands = {};
    this.configCommandName = 'config';
    this.updateCommandName = 'update';
    this.bindCommandName = 'xbind';
  }

  _usage () {

  }

  usage (func) {
    this._usage = func;
  }

  install (name) {

  }

  _bindCommand (name, info, args) {
    const commands = JSON.parse(config.get('commands', '[]'));
    if (info.indexOf(':') === -1) {
      info = 'npm:' + info;
    }
    commands.push({ name, package: info, args });
    config.set('commands', JSON.stringify(commands));
    config.save();
  }

  _updateCommand (nameAndVersion) {
    let find = false;
    const [name, version] = nameAndVersion.split('@');
    for (const key in this._commands) {
      if (this._commands.hasOwnProperty(key)) {
        const command = this._commands[key];
        if (command.package && command.package.remote && command.package.name === name) {
          find = command;
          break;
        }
      }
    }
    if (find) {
      if (version)find.package.requiredVersion = version;
      installer.update(find.package);
    }
    else {
      throw new Error('no command found depend on package "' + name + '"');
    }
  }

  _configCommand (name, value) {
    if (name) {
      config.set(name, value);
      config.save();
    }
    else {
      config.display();
      // throw new Error('config name can not be empty')
    }
  }

  version (ver) {
    if (typeof ver !== 'function') {
      this._version = function () {
        console.log('   v' + ver);
      };
    }
    else {
      this._version = ver;
    }
  }

  command (command, location, args, description) {
    if (!this.begin) {
      this.begin = true;
      process.nextTick(() => {
        this._done();
      });
    }
    this.currentCommand = this._commands[command] = new Command(command, location, args, description);
    return this;
  }

  locate (resolvePath) {
    if (this.currentCommand) {
      this.currentCommand.locate(resolvePath);
    }
    else {
      console.error('resolve(...) must after a command(...)');
    }
  }

  showSubVersion () {
    const map = {};
    for (const key in this._commands) {
      if (this._commands.hasOwnProperty(key)) {
        const command = this._commands[key];
        if (command.package.remote && !map[command.package.name]) {
          map[command.package.name] = true;
          if (fs.existsSync(command.package.path)) {
            const version = JSON.parse(fs.readFileSync(path.join(command.package.path, 'package.json')).toString()).version;
            console.log(chalk.gray(' - ' + command.package.name + ' : v' + version));
          }
        }
      }
    }
  }

  _resolveInternalCommand () {
    this.command(this.configCommandName, this._configCommand.bind(this));
    this.command(this.updateCommandName, this._updateCommand.bind(this));
    this.command(this.bindCommandName, this._bindCommand.bind(this));
  }

  _resolveBindCommand () {
    const commands = JSON.parse(config.get('commands', '[]'));
    commands.forEach((cmd) => {
      this._commands[cmd.name] = new Command(cmd.name, cmd.package, cmd.args);
    });
  }

  _done () {
    this._resolveInternalCommand();
    this._resolveBindCommand();
    const argv = new Argv(process.argv.slice(2));
    const cmd = argv._params[0];
    if (this._commands[cmd]) {
      this._commands[cmd].run();
    }
    else if (this._commands['']) {
      if ((argv.version || argv.v) && this._version) {
        this._version();
        this.showSubVersion();
      }
      else {
        this._commands[''].run();
      }
    }
  }
}

module.exports = new XToolkit();