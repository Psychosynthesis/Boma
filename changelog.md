# Boma Changelog

## v.2.1.1
Numerous improvements and bug fixes. Improved asynchronous writing (within a single process).
Added `throwError` flag to implement the ability to handle all errors independently in the consumer project.
This file has been added - just for the convenience of tracking changes.

## v.2.1.0
Added support for asynchronous operations. This is implemented through separate functions in source,
but the external contract remains compatible (does not require changes in consuming projects):
```
SaveJSONProps { filePath; objToSave; format?; logSaving?; replaceNonSerializable?; silent?; async? }
```
To use an asynchronous operation that returns a promise, now you can pass the `async` flag in the parameters.

## v.2.0.0
The function `saveJSON` parameter format has been changed (breaking change).
Function `saveJSON` now accepts an object: `{ filePath, objToSave, format = false, logSaving = false }`
The `isSerializable` check and `getDate` function have been added for better saving and improve logging.

## v.1.0.0
The first version of a simple, primitive helper: without proper exception handling,
without any support for async, with minimal typing, and a ton of bugs.
The `saveJSON` method accepted sequential arguments: `saveJSON(filePath, objToSave, format)`
