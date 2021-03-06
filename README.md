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

#### `timestamp`
Boolean. If true will create month folder in dstPath and append timestamp to dstPath

Default: false

Will use final directory in dstPath as project name

Example path given date of April 3rd 2020 at 09:30: `destination/path/2020-04/projectName_2020-04-03_09-30/`

## Example usage

```yaml
uses: funvr/fvr-action-copy-to-dropbox@v0.3.0
    with:
        token: ${{ secrets.DROPBOX_ACCESS_TOKEN }}
        srcPath: path/to/your/build/
        dstPath: /destination/path/projectName/
        timestamp: true

```