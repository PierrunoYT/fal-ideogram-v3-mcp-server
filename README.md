# fal-ai/ideogram/v3 MCP Server

A Model Context Protocol (MCP) server that provides access to the fal-ai/ideogram/v3 image generation model. This server allows you to generate high-quality images with superior text rendering capabilities using advanced AI technology through the fal.ai platform.

## Features

- **High-Quality Image Generation**: Generate stunning images using the fal-ai/ideogram/v3 model
- **Superior Text Rendering**: Advanced text-to-image generation with excellent text quality
- **Multiple Generation Methods**: Support for synchronous and queue-based generation
- **Flexible Image Sizing**: Support for predefined sizes and custom dimensions
- **Advanced Style Control**: Style presets, style codes, and color palettes
- **Style Reference Images**: Use reference images to guide the generation style
- **Local Image Download**: Automatically downloads generated images to local storage
- **Queue Management**: Submit long-running requests and check their status
- **Webhook Support**: Optional webhook notifications for completed requests

## Installation

1. Clone this repository:
```bash
git clone https://github.com/PierrunoYT/fal-ideogram-v3-mcp-server.git
cd fal-ideogram-v3-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Environment Variables

Set your fal.ai API key as an environment variable:

```bash
export FAL_KEY="your_fal_api_key_here"
```

You can get your API key from [fal.ai](https://fal.ai/).

### MCP Client Configuration

Add this server to your MCP client configuration. For example, in Claude Desktop's config file:

```json
{
  "mcpServers": {
    "fal-ideogram-v3": {
      "command": "npx",
      "args": ["-y", "https://github.com/PierrunoYT/fal-ideogram-v3-mcp-server.git"],
      "env": {
        "FAL_KEY": "your_fal_api_key_here"
      }
    }
  }
}
```

If the package is published to npm, you can use:

```json
{
  "mcpServers": {
    "fal-ideogram-v3": {
      "command": "npx",
      "args": ["fal-ideogram-v3-mcp-server"],
      "env": {
        "FAL_KEY": "your_fal_api_key_here"
      }
    }
  }
}
```

Alternatively, if you've cloned the repository locally:

```json
{
  "mcpServers": {
    "fal-ideogram-v3": {
      "command": "node",
      "args": ["/path/to/fal-ideogram-v3-mcp-server/build/index.js"],
      "env": {
        "FAL_KEY": "your_fal_api_key_here"
      }
    }
  }
}
```

## Available Tools

### 1. `ideogram_v3_generate`

Generate images using the standard synchronous method.

**Parameters:**
- `prompt` (required): Text description of the image to generate
- `negative_prompt` (optional): What you don't want in the image
- `image_size` (optional): Predefined size or custom {width, height} object (default: "square_hd")
- `rendering_speed` (optional): "TURBO", "BALANCED", or "QUALITY" (default: "BALANCED")
- `style` (optional): "AUTO", "GENERAL", "REALISTIC", or "DESIGN"
- `style_codes` (optional): Array of 8-character hexadecimal style codes
- `color_palette` (optional): Color palette preset or custom RGB colors
- `image_urls` (optional): Array of style reference image URLs
- `expand_prompt` (optional): Use MagicPrompt enhancement (default: true)
- `num_images` (optional): Number of images to generate (1-4, default: 1)
- `seed` (optional): Random seed for reproducible results
- `sync_mode` (optional): Wait for completion (default: true)

**Example:**
```json
{
  "prompt": "The Bone Forest stretched across the horizon, its trees fashioned from the ossified remains of ancient leviathans that once swam through the sky. In sky writes \"Ideogram V3 in fal.ai\"",
  "image_size": "square_hd",
  "rendering_speed": "BALANCED",
  "style": "GENERAL"
}
```

### 2. `ideogram_v3_generate_queue`

Submit a long-running image generation request to the queue.

**Parameters:** Same as `ideogram_v3_generate` plus:
- `webhook_url` (optional): URL for webhook notifications

**Returns:** A request ID for tracking the job

### 3. `ideogram_v3_queue_status`

Check the status of a queued request.

**Parameters:**
- `request_id` (required): The request ID from queue submission
- `logs` (optional): Include logs in response (default: true)

### 4. `ideogram_v3_queue_result`

Get the result of a completed queued request.

**Parameters:**
- `request_id` (required): The request ID from queue submission

## Image Sizes

### Predefined Sizes
- `square_hd`: High-definition square
- `square`: Standard square
- `portrait_4_3`: Portrait 4:3 aspect ratio
- `portrait_16_9`: Portrait 16:9 aspect ratio
- `landscape_4_3`: Landscape 4:3 aspect ratio
- `landscape_16_9`: Landscape 16:9 aspect ratio

### Custom Sizes
You can also specify custom dimensions:
```json
{
  "image_size": {
    "width": 1280,
    "height": 720
  }
}
```

## Style Control

### Style Presets
Use predefined styles:
```json
{
  "style": "REALISTIC"
}
```

### Style Codes
Use 8-character hexadecimal style codes:
```json
{
  "style_codes": ["A1B2C3D4", "E5F6A7B8"]
}
```

**Note:** Cannot use both `style` and `style_codes` together.

### Color Palettes

#### Preset Palettes
```json
{
  "color_palette": {
    "name": "EMBER"
  }
}
```

Available presets: EMBER, FRESH, JUNGLE, MAGIC, MELON, MOSAIC, PASTEL, ULTRAMARINE

#### Custom Color Palettes
```json
{
  "color_palette": {
    "members": [
      {
        "rgb": {"r": 255, "g": 0, "b": 0},
        "color_weight": 0.7
      },
      {
        "rgb": {"r": 0, "g": 255, "b": 0},
        "color_weight": 0.3
      }
    ]
  }
}
```

## Style Reference Images

Use reference images to guide the generation style:
```json
{
  "image_urls": [
    "https://example.com/style-reference1.jpg",
    "https://example.com/style-reference2.png"
  ]
}
```

**Note:** Maximum total size of 10MB across all style references. Supported formats: JPEG, PNG, WebP.

## Rendering Speed

Control the quality vs speed trade-off:
- `TURBO`: Fastest generation, lower quality
- `BALANCED`: Good balance of speed and quality (default)
- `QUALITY`: Highest quality, slower generation

## Output

Generated images are automatically downloaded to a local `images/` directory with descriptive filenames. The response includes:

- Local file paths
- Original URLs
- Image dimensions (when available)
- Content types
- File sizes (when available)
- Generation parameters used
- Request IDs for tracking
- Seed values for reproducibility

## Error Handling

The server provides detailed error messages for:
- Missing API keys
- Invalid parameters
- Conflicting parameters (e.g., using both style and style_codes)
- Network issues
- API rate limits
- Generation failures

## Development

### Running in Development Mode

```bash
npm run dev
```

### Testing the Server

```bash
npm test
```

### Getting the Installation Path

```bash
npm run get-path
```

## API Reference

This server implements the fal-ai/ideogram/v3 API. For detailed API documentation, visit:
- [fal.ai Documentation](https://fal.ai/models/fal-ai/ideogram/v3)
- [fal.ai Client Library](https://github.com/fal-ai/fal-js)

## Examples

### Basic Text-to-Image Generation
```json
{
  "prompt": "A majestic dragon soaring through clouds with 'Hello World' written in the sky"
}
```

### Advanced Generation with Style Control
```json
{
  "prompt": "A cyberpunk cityscape at night",
  "style": "DESIGN",
  "color_palette": {"name": "ULTRAMARINE"},
  "rendering_speed": "QUALITY",
  "image_size": "landscape_16_9"
}
```

### Using Style Reference Images
```json
{
  "prompt": "A portrait of a woman in Renaissance style",
  "image_urls": ["https://example.com/renaissance-painting.jpg"],
  "style": "REALISTIC"
}
```

### Queue-based Generation with Webhook
```json
{
  "prompt": "A detailed architectural drawing of a futuristic building",
  "rendering_speed": "QUALITY",
  "webhook_url": "https://your-server.com/webhook"
}
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/PierrunoYT/fal-ideogram-v3-mcp-server/issues)
- Check the [fal.ai documentation](https://fal.ai/docs)

## Changelog

### v1.0.0
- Initial release with fal-ai/ideogram/v3 API support
- Text-to-image generation with superior text rendering
- Style control with presets, codes, and color palettes
- Style reference image support
- Queue management with webhook support
- Local image download functionality
- Comprehensive error handling