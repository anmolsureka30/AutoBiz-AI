use serde::{Serialize, Deserialize};
use tract_core::tract_ndarray::{Array, ArrayD, Array3, Array4};
use image::{ImageBuffer, DynamicImage, GenericImageView};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PreprocessingError {
    #[error("Image processing failed: {0}")]
    ImageError(String),
    #[error("Invalid dimensions: {0}")]
    DimensionError(String),
    #[error("Unsupported format: {0}")]
    FormatError(String),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ResizeOptions {
    width: u32,
    height: u32,
    method: String, // "bilinear", "nearest", "bicubic"
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NormalizeOptions {
    mean: Option<Vec<f32>>,
    std: Option<Vec<f32>>,
    scale: Option<f32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PreprocessingOptions {
    resize: Option<ResizeOptions>,
    normalize: Option<NormalizeOptions>,
    color_space: Option<String>, // "RGB", "BGR", "GRAYSCALE"
    layout: Option<String>, // "NHWC", "NCHW"
}

pub struct ImagePreprocessor {
    options: PreprocessingOptions,
}

impl ImagePreprocessor {
    pub fn new(options: PreprocessingOptions) -> Self {
        Self { options }
    }

    pub fn process(&self, data: &[u8]) -> Result<ArrayD<f32>, PreprocessingError> {
        // Load image
        let img = image::load_from_memory(data)
            .map_err(|e| PreprocessingError::ImageError(e.to_string()))?;

        // Resize if needed
        let img = if let Some(resize) = &self.options.resize {
            self.resize_image(&img, resize)?
        } else {
            img
        };

        // Convert color space
        let img = self.convert_color_space(&img)?;

        // Convert to array
        let arr = self.image_to_array(&img)?;

        // Normalize
        let arr = if let Some(normalize) = &self.options.normalize {
            self.normalize_array(arr, normalize)?
        } else {
            arr
        };

        // Convert layout if needed
        let arr = if let Some(layout) = &self.options.layout {
            self.convert_layout(arr, layout)?
        } else {
            arr
        };

        Ok(arr)
    }

    fn resize_image(&self, img: &DynamicImage, options: &ResizeOptions) -> Result<DynamicImage, PreprocessingError> {
        let filter = match options.method.as_str() {
            "bilinear" => image::imageops::FilterType::Triangle,
            "nearest" => image::imageops::FilterType::Nearest,
            "bicubic" => image::imageops::FilterType::CatmullRom,
            _ => return Err(PreprocessingError::FormatError("Invalid resize method".into())),
        };

        Ok(img.resize_exact(options.width, options.height, filter))
    }

    fn convert_color_space(&self, img: &DynamicImage) -> Result<DynamicImage, PreprocessingError> {
        match self.options.color_space.as_deref() {
            Some("RGB") => Ok(img.to_rgb8().into()),
            Some("BGR") => {
                let rgb = img.to_rgb8();
                let (width, height) = rgb.dimensions();
                let mut bgr = ImageBuffer::new(width, height);
                for (x, y, pixel) in rgb.enumerate_pixels() {
                    bgr.put_pixel(x, y, image::Rgb([pixel[2], pixel[1], pixel[0]]));
                }
                Ok(DynamicImage::ImageRgb8(bgr))
            },
            Some("GRAYSCALE") => Ok(img.to_luma8().into()),
            Some(format) => Err(PreprocessingError::FormatError(format.into())),
            None => Ok(img.clone()),
        }
    }

    fn image_to_array(&self, img: &DynamicImage) -> Result<Array3<f32>, PreprocessingError> {
        match img {
            DynamicImage::ImageRgb8(img) => {
                let (width, height) = img.dimensions();
                let mut arr = Array3::<f32>::zeros((3, height as usize, width as usize));
                for y in 0..height {
                    for x in 0..width {
                        let pixel = img.get_pixel(x, y);
                        for c in 0..3 {
                            arr[[c, y as usize, x as usize]] = pixel[c] as f32;
                        }
                    }
                }
                Ok(arr)
            },
            DynamicImage::ImageLuma8(img) => {
                let (width, height) = img.dimensions();
                let mut arr = Array3::<f32>::zeros((1, height as usize, width as usize));
                for y in 0..height {
                    for x in 0..width {
                        arr[[0, y as usize, x as usize]] = img.get_pixel(x, y)[0] as f32;
                    }
                }
                Ok(arr)
            },
            _ => Err(PreprocessingError::FormatError("Unsupported image format".into())),
        }
    }

    fn normalize_array(&self, mut arr: Array3<f32>, options: &NormalizeOptions) -> Result<Array3<f32>, PreprocessingError> {
        // Scale to 0-1
        if let Some(scale) = options.scale {
            arr.mapv_inplace(|x| x * scale);
        } else {
            arr.mapv_inplace(|x| x / 255.0);
        }

        // Apply mean and std
        if let (Some(mean), Some(std)) = (&options.mean, &options.std) {
            if mean.len() != std.len() || mean.len() != arr.shape()[0] {
                return Err(PreprocessingError::DimensionError(
                    "Mean and std dimensions must match channel count".into()
                ));
            }

            for c in 0..mean.len() {
                arr.slice_mut(s![c, .., ..])
                    .mapv_inplace(|x| (x - mean[c]) / std[c]);
            }
        }

        Ok(arr)
    }

    fn convert_layout(&self, arr: Array3<f32>, layout: &str) -> Result<ArrayD<f32>, PreprocessingError> {
        match layout {
            "NCHW" => Ok(arr.insert_axis(ndarray::Axis(0)).into_dyn()),
            "NHWC" => Ok(arr.permuted_axes([1, 2, 0]).insert_axis(ndarray::Axis(0)).into_dyn()),
            _ => Err(PreprocessingError::FormatError("Invalid layout".into())),
        }
    }
} 