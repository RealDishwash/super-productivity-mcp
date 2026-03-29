(function () {
  var PLUGIN_NAME = "MCP Bridge";
  var MCP_SERVER_URL = "http://localhost:3000";

  function log(message) {
    console.log("[" + PLUGIN_NAME + "] " + message);
  }

  function logError(message, error) {
    console.error("[" + PLUGIN_NAME + "] " + message, error);
  }

  function toErrorPayload(error) {
    if (error && typeof error.message === "string") {
      return { error: error.message };
    }

    return { error: String(error) };
  }

  function safeAck(callback, payload) {
    if (typeof callback === "function") {
      callback(payload);
    }
  }

  function registerAsyncHandler(socket, eventName, handler) {
    socket.on(eventName, function (payload, callback) {
      Promise.resolve()
        .then(function () {
          return handler(payload);
        })
        .then(function (result) {
          safeAck(callback, result);
        })
        .catch(function (error) {
          safeAck(callback, toErrorPayload(error));
        });
    });
  }

  function normalizeNotifyConfig(config) {
    var message = config && (config.message || config.body) ? String(config.message || config.body) : "";
    var title = config && config.title ? String(config.title) : "Super Productivity MCP";

    return {
      title: title,
      body: message,
    };
  }

  function normalizeSnackConfig(config) {
    return {
      msg: config && (config.msg || config.message) ? String(config.msg || config.message) : "",
      type: config && config.type ? config.type : "INFO",
      ico: config && config.ico ? config.ico : undefined,
    };
  }

  function normalizeDialogConfig(config) {
    if (config && (config.htmlContent || config.buttons)) {
      return config;
    }

    var title = config && config.title ? "<h2 style=\"margin-top:0\">" + escapeHtml(String(config.title)) + "</h2>" : "";
    var message = config && config.message ? "<p>" + escapeHtml(String(config.message)) + "</p>" : "<p>No message provided.</p>";
    var dialogType = config && config.type ? config.type : "CONFIRM";
    var buttons = [];

    if (dialogType === "CONFIRM") {
      buttons.push({
        label: config && config.cancelText ? String(config.cancelText) : "Cancel",
        onClick: function () {},
      });
    }

    buttons.push({
      label: config && config.confirmText ? String(config.confirmText) : "OK",
      raised: true,
      color: "primary",
      onClick: function () {},
    });

    return {
      htmlContent: title + message,
      buttons: buttons,
    };
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function registerCommandHandlers(api, socket) {
    registerAsyncHandler(socket, "tasks:get", function () {
      return api.getTasks();
    });

    registerAsyncHandler(socket, "tasks:getCurrent", function () {
      return api.getCurrentContextTasks();
    });

    registerAsyncHandler(socket, "tasks:create", function (taskData) {
      return api.addTask(taskData);
    });

    registerAsyncHandler(socket, "tasks:update", function (data) {
      return api.updateTask(data.taskId, data.updates).then(function () {
        return { success: true };
      });
    });

    registerAsyncHandler(socket, "tasks:delete", function (data) {
      return api.deleteTask(data.taskId).then(function () {
        return { success: true };
      });
    });

    registerAsyncHandler(socket, "tasks:batch", function (data) {
      return api.batchUpdateForProject(data);
    });

    registerAsyncHandler(socket, "projects:get", function () {
      return api.getAllProjects();
    });

    registerAsyncHandler(socket, "projects:create", function (projectData) {
      return api.addProject(projectData);
    });

    registerAsyncHandler(socket, "tags:get", function () {
      return api.getAllTags();
    });

    registerAsyncHandler(socket, "tags:create", function (tagData) {
      return api.addTag(tagData);
    });

    registerAsyncHandler(socket, "tags:update", function (data) {
      return api.updateTag(data.tagId, data.updates).then(function () {
        return { success: true };
      });
    });

    registerAsyncHandler(socket, "ui:notify", function (config) {
      return api.notify(normalizeNotifyConfig(config)).then(function () {
        return { success: true };
      });
    });

    registerAsyncHandler(socket, "ui:showSnack", function (config) {
      api.showSnack(normalizeSnackConfig(config));
      return { success: true };
    });

    registerAsyncHandler(socket, "ui:openDialog", function (config) {
      return api.openDialog(normalizeDialogConfig(config)).then(function () {
        return { success: true };
      });
    });
  }

  function registerHookForwarders(api, socket) {
    var hookMappings = [
      { hook: "anyTaskUpdate", event: "event:taskUpdate" },
      { hook: "projectListUpdate", event: "event:projectListUpdate" },
      { hook: "currentTaskChange", event: "event:currentTaskChange" },
      { hook: "taskComplete", event: "event:taskComplete" },
      { hook: "taskUpdate", event: "event:taskSingleUpdate" },
      { hook: "taskDelete", event: "event:taskDelete" },
    ];

    hookMappings.forEach(function (mapping) {
      api.registerHook(mapping.hook, function (payload) {
        socket.emit(mapping.event, payload);
      });
    });
  }

  function initPlugin(api) {
    log("Loading plugin logic");

    var socket = io(MCP_SERVER_URL, {
      reconnectionDelayMax: 10000,
    });

    socket.on("connect", function () {
      log("Connected to MCP server via WebSocket");
    });

    socket.on("disconnect", function () {
      log("Disconnected from MCP server");
    });

    socket.on("connect_error", function (error) {
      logError("Connection error:", error);
    });

    registerCommandHandlers(api, socket);
    registerHookForwarders(api, socket);
  }

  if (typeof PluginAPI !== "undefined") {
    initPlugin(PluginAPI);
  } else {
    logError("PluginAPI not found", new Error("PluginAPI is undefined"));
  }
})();
