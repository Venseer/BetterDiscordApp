@echo off

set "ELECTRON=1.6.15"
set "PLATFORM=win32"
set "ARCH=ia32"
set "VER=53"
set "VENDOR_PATH=.\node_modules\node-sass\vendor"
set "BUILD_PATH=.\node_modules\node-sass\build\Release\binding.node"

echo Building %PLATFORM%-%ARCH% bindings
call ./node_modules/.bin/electron-rebuild -v=%ELECTRON% -a=%ARCH% -m ./node_modules/node-sass

if exist %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%\binding.node (
    echo Deleting old %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%\binding.node
    del /S /Q %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%\*
)

if not exist %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER% (
    echo Dir %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER% does not exist, creating.
    mkdir %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%
)

if not exist %BUILD_PATH% (
    echo %BUILD_PATH% Does not exist
) else (
    echo Copying %BUILD_PATH% to %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%
    copy %BUILD_PATH% %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%
)

set "ARCH=x64"

echo Building %PLATFORM%-%ARCH% bindings
call ./node_modules/.bin/electron-rebuild -v=%ELECTRON% -a=%ARCH% -m ./node_modules/node-sass

if exist %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%\binding.node (
    echo Deleting old %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%\binding.node
    del /S /Q %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%\*
)

if not exist %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER% (
    echo Dir %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER% does not exist, creating.
    mkdir %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%
)

if not exist %BUILD_PATH% (
    echo %BUILD_PATH% Does not exist
) else (
    echo Copying %BUILD_PATH% to %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%
    copy %BUILD_PATH% %VENDOR_PATH%\%PLATFORM%-%ARCH%-%VER%
)
