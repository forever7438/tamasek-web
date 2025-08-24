/**
 * 淡马锡网站全局配置文件
 * 集中管理所有重要的URL和配置信息
 */

window.TemasekConfig = {
    // 用户认证相关URL
    auth: {
        loginUrl: 'http://localhost:8880/level/index.html#/login',
        registerUrl: 'http://localhost:8880/level/index.html#/register'
    },

    // TSIA相关按钮URL
    tsia: {
        tsiaTlakUrl: 'https://example.com/tsia-tlak',  // TSIA TLAK按钮链接
        tsiaUrl: 'https://example.com/tsia'           // TSIA按钮链接
    },

    // 语言配置
    languages: {
        current: 'zh',
        available: ['zh', 'en'],
        defaultLanguage: 'zh'
    },
};

/**
 * 获取登录URL
 * @returns {string} 登录页面URL
 */
window.getLoginUrl = function () {
    return window.TemasekConfig.auth.loginUrl;
};

/**
 * 获取注册URL
 * @returns {string} 注册页面URL
 */
window.getRegisterUrl = function () {
    return window.TemasekConfig.auth.registerUrl;
};

/**
 * 获取TSIA TLAK按钮URL
 * @returns {string} TSIA TLAK页面URL
 */
window.getTsiaTlakUrl = function () {
    return window.TemasekConfig.tsia.tsiaTlakUrl;
};

/**
 * 获取TSIA按钮URL
 * @returns {string} TSIA页面URL
 */
window.getTsiaUrl = function () {
    return window.TemasekConfig.tsia.tsiaUrl;
};

/**
 * 更新认证按钮链接
 * 在页面加载后自动调用，更新登录和注册按钮的链接
 */
window.updateAuthButtons = function () {
    // 更新登录按钮
    const loginButtons = document.querySelectorAll('.link-login-btn, a[class*="link-login"]');
    loginButtons.forEach(button => {
        if (button) {
            button.href = window.getLoginUrl();
        }
    });

    // 更新注册按钮
    const registerButtons = document.querySelectorAll('.link-register-btn, a[class*="link-register"]');
    registerButtons.forEach(button => {
        if (button) {
            button.href = window.getRegisterUrl();
        }
    });

    // 更新TSIA TLAK按钮
    const tsiaTlakButtons = document.querySelectorAll('.tsia-tlak-btn');
    tsiaTlakButtons.forEach(button => {
        if (button) {
            button.href = window.getTsiaTlakUrl();
        }
    });

    // 更新TSIA按钮
    const tsiaButtons = document.querySelectorAll('.tsia-btn');
    tsiaButtons.forEach(button => {
        if (button) {
            button.href = window.getTsiaUrl();
        }
    });
};

// 页面加载完成后自动更新按钮链接
document.addEventListener('DOMContentLoaded', function () {
    window.updateAuthButtons();
});

// 支持页面动态加载的情况
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.updateAuthButtons);
} else {
    // DOM已经加载完成
    window.updateAuthButtons();
}
