# Copy to Dropbox

## Copies directory contents to DropBox

### Inputs

#### `token`
Dropbox Access Token.

Follow this guide to generate a token:  
https://preventdirectaccess.com/docs/create-app-key-access-token-for-dropbox-account/

#### `srcPath`
Directory containing files to upload

#### `dstPath`
Destination path prefix where files will be stored

Note: Path must start with a leading /

## Example usage

```yaml
uses: funvr/fvr-action-copy-to-dropbox@0.0.1
    with:
        token: ${{ secrets.DROPBOX_ACCESS_TOKEN }}
        srcPath: path/to/your/build/
        dstPath: /destination/path/
```