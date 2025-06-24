#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fal } from "@fal-ai/client";
import { writeFile } from "fs/promises";
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Check for required environment variable
const FAL_KEY = process.env.FAL_KEY;
let falConfigured = false;

if (!FAL_KEY) {
  console.error('FAL_KEY environment variable is required');
  console.error('Please set your fal.ai API key: export FAL_KEY=your_api_key_here');
  // Server continues running, no process.exit()
} else {
  // Configure fal.ai client
  fal.config({
    credentials: FAL_KEY
  });
  falConfigured = true;
}

// Define types based on fal-ai/ideogram/v3 API documentation
interface IdeogramImageResult {
  images: Array<{
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  }>;
  seed?: number;
}

// Define input schema types
interface ImageSize {
  width: number;
  height: number;
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface ColorPaletteMember {
  rgb: RGBColor;
  color_weight?: number;
}

interface ColorPalette {
  members?: ColorPaletteMember[];
  name?: "EMBER" | "FRESH" | "JUNGLE" | "MAGIC" | "MELON" | "MOSAIC" | "PASTEL" | "ULTRAMARINE";
}

// Download image function
async function downloadImage(url: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      // Create images directory if it doesn't exist
      const imagesDir = path.join(process.cwd(), 'images');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      const filePath = path.join(imagesDir, filename);
      const file = fs.createWriteStream(filePath);
      
      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });
        
        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // Delete partial file
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Generate safe filename for images
function generateImageFilename(prompt: string, index: number, seed?: number): string {
  const safePrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const seedStr = seed ? `_${seed}` : '';
  return `ideogram_v3_${safePrompt}${seedStr}_${index}_${timestamp}.png`;
}

// Create MCP server
const server = new McpServer({
  name: "fal-ideogram-v3-server",
  version: "1.0.0",
});

// Tool: Generate images with fal-ai/ideogram/v3
server.tool(
  "ideogram_v3_generate",
  {
    description: "Generate high-quality images using fal-ai/ideogram/v3 - Advanced text-to-image generation model with superior text rendering capabilities",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The text prompt to generate an image from"
        },
        negative_prompt: {
          type: "string",
          description: "Description of what to exclude from an image. Descriptions in the prompt take precedence to descriptions in the negative prompt",
          default: ""
        },
        image_size: {
          oneOf: [
            {
              type: "string",
              enum: ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"],
              description: "Predefined image size"
            },
            {
              type: "object",
              properties: {
                width: {
                  type: "integer",
                  description: "The width of the generated image",
                  default: 512
                },
                height: {
                  type: "integer", 
                  description: "The height of the generated image",
                  default: 512
                }
              },
              required: ["width", "height"]
            }
          ],
          description: "The resolution of the generated image. Can be a predefined size or custom width/height",
          default: "square_hd"
        },
        rendering_speed: {
          type: "string",
          enum: ["TURBO", "BALANCED", "QUALITY"],
          description: "The rendering speed to use",
          default: "BALANCED"
        },
        style: {
          type: "string",
          enum: ["AUTO", "GENERAL", "REALISTIC", "DESIGN"],
          description: "The style type to generate with. Cannot be used with style_codes"
        },
        style_codes: {
          type: "array",
          items: {
            type: "string",
            pattern: "^[0-9A-Fa-f]{8}$"
          },
          description: "A list of 8 character hexadecimal codes representing the style of the image. Cannot be used in conjunction with style"
        },
        color_palette: {
          type: "object",
          properties: {
            name: {
              type: "string",
              enum: ["EMBER", "FRESH", "JUNGLE", "MAGIC", "MELON", "MOSAIC", "PASTEL", "ULTRAMARINE"],
              description: "A color palette preset value"
            },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  rgb: {
                    type: "object",
                    properties: {
                      r: { type: "integer", minimum: 0, maximum: 255 },
                      g: { type: "integer", minimum: 0, maximum: 255 },
                      b: { type: "integer", minimum: 0, maximum: 255 }
                    },
                    required: ["r", "g", "b"]
                  },
                  color_weight: {
                    type: "number",
                    description: "The weight of the color in the color palette",
                    default: 0.5
                  }
                },
                required: ["rgb"]
              },
              description: "A list of color palette members that define the color palette"
            }
          },
          description: "A color palette for generation, must EITHER be specified via one of the presets (name) or explicitly via hexadecimal representations of the color with optional weights (members)"
        },
        image_urls: {
          type: "array",
          items: {
            type: "string"
          },
          description: "A set of images to use as style references (maximum total size 10MB across all style references). The images should be in JPEG, PNG or WebP format"
        },
        expand_prompt: {
          type: "boolean",
          description: "Determine if MagicPrompt should be used in generating the request or not",
          default: true
        },
        num_images: {
          type: "integer",
          description: "Number of images to generate",
          default: 1,
          minimum: 1,
          maximum: 4
        },
        seed: {
          type: "integer",
          description: "Seed for the random number generator"
        },
        sync_mode: {
          type: "boolean",
          description: "If set to true, the function will wait for the image to be generated and uploaded before returning the response",
          default: true
        }
      },
      required: ["prompt"]
    }
  },
  async (args: any) => {
    // Check if fal.ai client is configured
    if (!falConfigured) {
      return {
        content: [{
          type: "text",
          text: "Error: FAL_KEY environment variable is not set. Please configure your fal.ai API key."
        }],
        isError: true
      };
    }

    const { 
      prompt, 
      negative_prompt = "",
      image_size = "square_hd",
      rendering_speed = "BALANCED",
      style,
      style_codes,
      color_palette,
      image_urls,
      expand_prompt = true,
      num_images = 1,
      seed,
      sync_mode = true
    } = args;
    
    try {
      // Validate that style and style_codes are not used together
      if (style && style_codes && style_codes.length > 0) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot use both 'style' and 'style_codes' parameters together. Please use only one."
          }],
          isError: true
        };
      }

      // Prepare input for fal.ai API
      const input: any = {
        prompt,
        negative_prompt,
        image_size,
        rendering_speed,
        expand_prompt,
        num_images,
        sync_mode
      };

      // Add optional parameters if provided
      if (style) input.style = style;
      if (style_codes && style_codes.length > 0) input.style_codes = style_codes;
      if (color_palette) input.color_palette = color_palette;
      if (image_urls && image_urls.length > 0) input.image_urls = image_urls;
      if (seed !== undefined) input.seed = seed;

      console.error(`Generating image with fal-ai/ideogram/v3 - prompt: "${prompt}"`);

      // Call fal.ai ideogram/v3 API
      const result = await fal.subscribe("fal-ai/ideogram/v3", {
        input,
        logs: true,
        onQueueUpdate: (update: any) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log: any) => log.message).forEach(console.error);
          }
        },
      });

      const output = result.data as IdeogramImageResult;

      // Download images locally
      console.error("Downloading images locally...");
      const downloadedImages = [];

      for (let i = 0; i < output.images.length; i++) {
        const image = output.images[i];
        const filename = generateImageFilename(prompt, i + 1, output.seed);
        
        try {
          const localPath = await downloadImage(image.url, filename);
          downloadedImages.push({
            url: image.url,
            localPath,
            index: i + 1,
            content_type: image.content_type || 'image/png',
            file_name: image.file_name || filename,
            file_size: image.file_size,
            filename
          });
          console.error(`Downloaded: ${filename}`);
        } catch (downloadError) {
          console.error(`Failed to download image ${i + 1}:`, downloadError);
          // Still add the image info without local path
          downloadedImages.push({
            url: image.url,
            localPath: null,
            index: i + 1,
            content_type: image.content_type || 'image/png',
            file_name: image.file_name || filename,
            file_size: image.file_size,
            filename
          });
        }
      }

      // Format response with download information
      const imageDetails = downloadedImages.map(img => {
        let details = `Image ${img.index}:`;
        if (img.localPath) {
          details += `\n  Local Path: ${img.localPath}`;
        }
        details += `\n  Original URL: ${img.url}`;
        details += `\n  Filename: ${img.filename}`;
        details += `\n  Content Type: ${img.content_type}`;
        if (img.file_size) {
          details += `\n  File Size: ${img.file_size} bytes`;
        }
        return details;
      }).join('\n\n');

      const imageSizeStr = typeof image_size === 'string' ? image_size : `${image_size.width}x${image_size.height}`;

      const responseText = `Successfully generated ${downloadedImages.length} image(s) using fal-ai/ideogram/v3:

Prompt: "${prompt}"
${negative_prompt ? `Negative Prompt: "${negative_prompt}"` : ''}
Image Size: ${imageSizeStr}
Rendering Speed: ${rendering_speed}
${style ? `Style: ${style}` : ''}
${style_codes && style_codes.length > 0 ? `Style Codes: ${style_codes.join(', ')}` : ''}
${color_palette ? `Color Palette: ${color_palette.name || 'Custom'}` : ''}
${image_urls && image_urls.length > 0 ? `Style Reference Images: ${image_urls.length}` : ''}
Expand Prompt: ${expand_prompt}
${output.seed ? `Seed: ${output.seed}` : 'Seed: Auto-generated'}
Request ID: ${result.requestId}

Generated Images:
${imageDetails}

${downloadedImages.some(img => img.localPath) ? 'Images have been downloaded to the local \'images\' directory.' : 'Note: Local download failed, but original URLs are available.'}`;

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error generating image:', error);
      
      let errorMessage = "Failed to generate image with fal-ai/ideogram/v3.";
      
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Tool: Generate images using queue method
server.tool(
  "ideogram_v3_generate_queue",
  {
    description: "Submit a long-running image generation request to the queue using fal-ai/ideogram/v3",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The text prompt to generate an image from"
        },
        negative_prompt: {
          type: "string",
          description: "Description of what to exclude from an image",
          default: ""
        },
        image_size: {
          oneOf: [
            {
              type: "string",
              enum: ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"],
              description: "Predefined image size"
            },
            {
              type: "object",
              properties: {
                width: { type: "integer", default: 512 },
                height: { type: "integer", default: 512 }
              },
              required: ["width", "height"]
            }
          ],
          default: "square_hd"
        },
        rendering_speed: {
          type: "string",
          enum: ["TURBO", "BALANCED", "QUALITY"],
          default: "BALANCED"
        },
        style: {
          type: "string",
          enum: ["AUTO", "GENERAL", "REALISTIC", "DESIGN"]
        },
        style_codes: {
          type: "array",
          items: { type: "string", pattern: "^[0-9A-Fa-f]{8}$" }
        },
        color_palette: {
          type: "object",
          properties: {
            name: {
              type: "string",
              enum: ["EMBER", "FRESH", "JUNGLE", "MAGIC", "MELON", "MOSAIC", "PASTEL", "ULTRAMARINE"]
            },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  rgb: {
                    type: "object",
                    properties: {
                      r: { type: "integer", minimum: 0, maximum: 255 },
                      g: { type: "integer", minimum: 0, maximum: 255 },
                      b: { type: "integer", minimum: 0, maximum: 255 }
                    },
                    required: ["r", "g", "b"]
                  },
                  color_weight: { type: "number", default: 0.5 }
                },
                required: ["rgb"]
              }
            }
          }
        },
        image_urls: {
          type: "array",
          items: { type: "string" }
        },
        expand_prompt: {
          type: "boolean",
          default: true
        },
        num_images: {
          type: "integer",
          default: 1,
          minimum: 1,
          maximum: 4
        },
        seed: {
          type: "integer"
        },
        webhook_url: {
          type: "string",
          description: "Optional webhook URL for result notifications"
        }
      },
      required: ["prompt"]
    }
  },
  async (args: any) => {
    if (!falConfigured) {
      return {
        content: [{
          type: "text",
          text: "Error: FAL_KEY environment variable is not set. Please configure your fal.ai API key."
        }],
        isError: true
      };
    }

    const { webhook_url, ...input } = args;
    
    try {
      // Validate that style and style_codes are not used together
      if (input.style && input.style_codes && input.style_codes.length > 0) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot use both 'style' and 'style_codes' parameters together. Please use only one."
          }],
          isError: true
        };
      }

      console.error(`Submitting queue request for fal-ai/ideogram/v3 - prompt: "${input.prompt}"`);

      const result = await fal.queue.submit("fal-ai/ideogram/v3", {
        input,
        webhookUrl: webhook_url
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully submitted image generation request to queue.

Request ID: ${result.request_id}
Prompt: "${input.prompt}"
${webhook_url ? `Webhook URL: ${webhook_url}` : 'No webhook configured'}

Use the request ID with ideogram_v3_queue_status to check progress or ideogram_v3_queue_result to get the final result.`
          }
        ]
      };

    } catch (error) {
      console.error('Error submitting queue request:', error);
      
      let errorMessage = "Failed to submit queue request for fal-ai/ideogram/v3.";
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Tool: Check queue status
server.tool(
  "ideogram_v3_queue_status",
  {
    description: "Check the status of a queued image generation request",
    inputSchema: {
      type: "object",
      properties: {
        request_id: {
          type: "string",
          description: "The request ID from queue submission"
        },
        logs: {
          type: "boolean",
          description: "Include logs in response",
          default: true
        }
      },
      required: ["request_id"]
    }
  },
  async (args: any) => {
    if (!falConfigured) {
      return {
        content: [{
          type: "text",
          text: "Error: FAL_KEY environment variable is not set. Please configure your fal.ai API key."
        }],
        isError: true
      };
    }

    const { request_id, logs = true } = args;
    
    try {
      console.error(`Checking status for request: ${request_id}`);

      const status = await fal.queue.status("fal-ai/ideogram/v3", {
        requestId: request_id,
        logs
      });

      let responseText = `Queue Status for Request ID: ${request_id}

Status: ${status.status}`;

      if (status.response_url) {
        responseText += `\nResponse URL: ${status.response_url}`;
      }

      // Handle logs if available (logs might be in different property depending on status)
      const statusAny = status as any;
      if (statusAny.logs && statusAny.logs.length > 0) {
        responseText += `\n\nLogs:\n${statusAny.logs.map((log: any) => `[${log.timestamp}] ${log.message}`).join('\n')}`;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error checking queue status:', error);
      
      let errorMessage = "Failed to check queue status.";
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Tool: Get queue result
server.tool(
  "ideogram_v3_queue_result",
  {
    description: "Get the result of a completed queued image generation request",
    inputSchema: {
      type: "object",
      properties: {
        request_id: {
          type: "string",
          description: "The request ID from queue submission"
        }
      },
      required: ["request_id"]
    }
  },
  async (args: any) => {
    if (!falConfigured) {
      return {
        content: [{
          type: "text",
          text: "Error: FAL_KEY environment variable is not set. Please configure your fal.ai API key."
        }],
        isError: true
      };
    }

    const { request_id } = args;
    
    try {
      console.error(`Getting result for request: ${request_id}`);

      const result = await fal.queue.result("fal-ai/ideogram/v3", {
        requestId: request_id
      });

      const output = result.data as IdeogramImageResult;

      // Download images locally
      console.error("Downloading images locally...");
      const downloadedImages = [];

      for (let i = 0; i < output.images.length; i++) {
        const image = output.images[i];
        const filename = generateImageFilename(`queue_result_${request_id}`, i + 1, output.seed);
        
        try {
          const localPath = await downloadImage(image.url, filename);
          downloadedImages.push({
            url: image.url,
            localPath,
            index: i + 1,
            content_type: image.content_type || 'image/png',
            file_name: image.file_name || filename,
            file_size: image.file_size,
            filename
          });
          console.error(`Downloaded: ${filename}`);
        } catch (downloadError) {
          console.error(`Failed to download image ${i + 1}:`, downloadError);
          downloadedImages.push({
            url: image.url,
            localPath: null,
            index: i + 1,
            content_type: image.content_type || 'image/png',
            file_name: image.file_name || filename,
            file_size: image.file_size,
            filename
          });
        }
      }

      const imageDetails = downloadedImages.map(img => {
        let details = `Image ${img.index}:`;
        if (img.localPath) {
          details += `\n  Local Path: ${img.localPath}`;
        }
        details += `\n  Original URL: ${img.url}`;
        details += `\n  Filename: ${img.filename}`;
        details += `\n  Content Type: ${img.content_type}`;
        if (img.file_size) {
          details += `\n  File Size: ${img.file_size} bytes`;
        }
        return details;
      }).join('\n\n');

      const responseText = `Queue Result for Request ID: ${request_id}

Successfully completed! Generated ${downloadedImages.length} image(s):

${output.seed ? `Seed: ${output.seed}` : 'Seed: Auto-generated'}

Generated Images:
${imageDetails}

${downloadedImages.some(img => img.localPath) ? 'Images have been downloaded to the local \'images\' directory.' : 'Note: Local download failed, but original URLs are available.'}`;

      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

    } catch (error) {
      console.error('Error getting queue result:', error);
      
      let errorMessage = "Failed to get queue result.";
      if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage
          }
        ],
        isError: true
      };
    }
  }
);

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});