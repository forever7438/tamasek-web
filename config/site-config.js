/**
 * 淡马锡网站全局配置文件
 * 集中管理所有重要的URL和配置信息
 */

window.TemasekConfig = {
    // 用户认证相关URL
    auth: {
        loginUrl: '/level/index.html#/login',
        registerUrl: '/level/index.html#/register',
        tradeCenterUrl: '/home/index.html#/market'
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
 * 检查用户是否已登录
 * @returns {boolean} 用户登录状态
 */
window.isUserLoggedIn = function () {
    const token = JSON.parse(localStorage.getItem('user'))?.userInfo?.token;
    return token && token.trim() !== '';
};

/**
 * 获取当前页面语言
 * @returns {string} 当前语言代码
 */
window.getCurrentLanguage = function () {
    const path = window.location.pathname;
    if (path.startsWith('/en/')) {
        return 'en';
    } else if (path.startsWith('/zh/')) {
        return 'zh';
    }
    return window.TemasekConfig.languages.defaultLanguage;
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
 * 获取交易中心URL
 * @returns {string} 交易中心页面URL
 */
window.getTradeCenterUrl = function () {
    return window.TemasekConfig.auth.tradeCenterUrl;
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
 * 退出登录
 */
window.logout = function () {
    localStorage.removeItem('token');
    // 刷新页面以更新按钮状态
    window.location.reload();
};

/**
 * 获取按钮文本配置
 * @param {boolean} isLoggedIn 是否已登录
 * @param {string} language 当前语言
 * @returns {object} 按钮文本配置
 */
window.getButtonTexts = function (isLoggedIn, language) {
    if (language === 'zh') {
        return isLoggedIn ?
            { first: '交易中心', second: '退出' } :
            { first: '登录', second: '注册' };
    } else {
        return isLoggedIn ?
            { first: 'Trade Center', second: 'Logout' } :
            { first: 'LOGIN', second: 'REGISTER' };
    }
};

/**
 * 更新认证按钮链接
 * 在页面加载后自动调用，更新登录和注册按钮的链接和文本
 */
window.updateAuthButtons = function () {
    const isLoggedIn = window.isUserLoggedIn();
    const currentLanguage = window.getCurrentLanguage();
    const buttonTexts = window.getButtonTexts(isLoggedIn, currentLanguage);

    // 更新第一个按钮（登录/交易中心）
    const firstButtons = document.querySelectorAll('.link-login-btn, a[class*="link-login"]');
    firstButtons.forEach(button => {
        if (button) {
            button.textContent = buttonTexts.first;
            if (isLoggedIn) {
                // 已登录：交易中心按钮，点击跳转到登录页面
                button.href = window.getTradeCenterUrl();
                button.onclick = null; // 清除之前可能的点击事件
            } else {
                // 未登录：登录按钮
                button.href = window.getLoginUrl();
                button.onclick = null; // 清除之前可能的点击事件
            }
        }
    });

    // 更新第二个按钮（注册/退出）
    const secondButtons = document.querySelectorAll('.link-register-btn, a[class*="link-register"]');
    secondButtons.forEach(button => {
        if (button) {
            button.textContent = buttonTexts.second;
            if (isLoggedIn) {
                // 已登录：退出按钮
                button.href = '#';
                button.onclick = function (e) {
                    e.preventDefault();
                    window.logout();
                    window.location.href = window.getLoginUrl();
                };
            } else {
                // 未登录：注册按钮
                button.href = window.getRegisterUrl();
                button.onclick = null; // 清除之前可能的点击事件
            }
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
